import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../generated/prisma/client.js';
import type { Allergen, Nutrition, Product, Profile, Restriction } from '../domain/types.js';
import type { Repositories } from './types.js';

type ProductRow = Prisma.ProductGetPayload<object>;

function toProduct(row: ProductRow): Product {
  return {
    barcode: row.barcode,
    name: row.name,
    ...(row.brand ? { brand: row.brand } : {}),
    ...(row.category ? { category: row.category } : {}),
    isLiquid: row.isLiquid,
    nutrition: (row.nutrition ?? {}) as Nutrition,
    ...(row.ingredientsText ? { ingredientsText: row.ingredientsText } : {}),
    allergensTags: row.allergensTags,
    tracesTags: row.tracesTags,
    additivesTags: row.additivesTags,
    source: row.source === 'user' ? 'user' : 'off',
    verified: row.verified,
  };
}

function productData(p: Product) {
  return {
    name: p.name,
    brand: p.brand ?? null,
    category: p.category ?? null,
    isLiquid: p.isLiquid,
    nutrition: p.nutrition as Prisma.InputJsonValue,
    ingredientsText: p.ingredientsText ?? null,
    allergensTags: p.allergensTags,
    tracesTags: p.tracesTags,
    additivesTags: p.additivesTags,
    source: p.source,
    verified: p.verified,
  };
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

export function createPrismaRepositories(db: PrismaClient): Repositories {
  return {
    products: {
      async findByBarcode(barcode) {
        const row = await db.product.findUnique({ where: { barcode } });
        return row ? toProduct(row) : null;
      },
      async upsert(product) {
        const data = productData(product);
        await db.product.upsert({
          where: { barcode: product.barcode },
          create: { barcode: product.barcode, ...data },
          update: data,
        });
      },
      async searchByName(query, limit) {
        const rows = await db.$queryRaw<ProductRow[]>`
          SELECT barcode, name, brand, category, is_liquid AS "isLiquid", nutrition,
                 ingredients_text AS "ingredientsText", allergens_tags AS "allergensTags",
                 traces_tags AS "tracesTags", additives_tags AS "additivesTags",
                 source, verified, created_at AS "createdAt"
          FROM search_products_by_name(${query}, ${limit}::int)`;
        return rows.map(toProduct);
      },
    },

    profiles: {
      async get(userId) {
        const row = await db.profile.findUnique({ where: { userId } });
        if (!row) return null;
        const profile: Profile = {
          goals: row.goals,
          allergens: row.allergens as Allergen[],
          restrictions: row.restrictions as Restriction[],
          lessSugar: row.lessSugar,
          lessSodium: row.lessSodium,
        };
        return { profile, consentAt: row.healthConsentAt };
      },
      async upsert(userId, profile, consentAt) {
        const data = {
          goals: profile.goals,
          allergens: profile.allergens,
          restrictions: profile.restrictions,
          lessSugar: profile.lessSugar,
          lessSodium: profile.lessSodium,
          healthConsentAt: consentAt,
        };
        await db.profile.upsert({
          where: { userId },
          create: { userId, ...data },
          update: data,
        });
      },
    },

    history: {
      async add(userId, barcode) {
        await db.scanHistory.create({ data: { userId, barcode } });
      },
      async list(userId, limit) {
        const rows = await db.scanHistory.findMany({
          where: { userId },
          orderBy: { scannedAt: 'desc' },
          take: limit,
          include: { product: true },
        });
        return rows.map((r) => ({ product: toProduct(r.product), scannedAt: r.scannedAt }));
      },
    },
  };
}
