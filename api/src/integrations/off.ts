import type { Nutrition, Product } from '../domain/types.js';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function isLiquid(product: Obj): boolean {
  const quantity = str(product.quantity) ?? '';
  if (/\d\s*(ml|cl|l)\b/i.test(quantity)) return true;
  return strArray(product.categories_tags).includes('en:beverages');
}

/** Converte a resposta do Open Food Facts em Product; null se não houver produto utilizável. */
export function mapOffProduct(off: unknown, barcode: string): Product | null {
  if (!isObj(off) || off.status === 0 || !isObj(off.product)) return null;
  const p = off.product;

  const name = str(p.product_name_pt) ?? str(p.product_name) ?? str(p.generic_name);
  if (!name) return null;

  const n = isObj(p.nutriments) ? p.nutriments : {};

  // OFF entrega sódio em gramas; sem sódio, deriva do sal (sódio ≈ 40% do sal).
  const sodiumG = num(n.sodium_100g);
  const saltG = num(n.salt_100g);
  const sodiumMg =
    sodiumG !== undefined ? sodiumG * 1000 : saltG !== undefined ? saltG * 400 : undefined;

  const nutrition: Nutrition = {};
  const set = <K extends keyof Nutrition>(key: K, value: number | undefined) => {
    if (value !== undefined) nutrition[key] = value;
  };
  set('energyKcal', num(n['energy-kcal_100g']));
  set('sugarsG', num(n.sugars_100g));
  set('addedSugarsG', num(n['added-sugars_100g']));
  set('saturatedFatG', num(n['saturated-fat_100g']));
  set('sodiumMg', sodiumMg);
  set('fiberG', num(n.fiber_100g));
  set('proteinG', num(n.proteins_100g));

  const brand = str(p.brands)?.split(',')[0]?.trim();
  const category = strArray(p.categories_tags)[0];
  const ingredients = str(p.ingredients_text_pt) ?? str(p.ingredients_text);

  return {
    barcode,
    name,
    ...(brand ? { brand } : {}),
    ...(category ? { category } : {}),
    isLiquid: isLiquid(p),
    nutrition,
    ...(ingredients ? { ingredientsText: ingredients } : {}),
    allergensTags: strArray(p.allergens_tags),
    tracesTags: strArray(p.traces_tags),
    additivesTags: strArray(p.additives_tags),
    source: 'off',
    verified: true,
  };
}

export type OffResult =
  | { kind: 'found'; product: Product }
  | { kind: 'not_found' }
  | { kind: 'error' };

export type OffLookup = (barcode: string) => Promise<OffResult>;

const FIELDS = [
  'code', 'product_name', 'product_name_pt', 'generic_name', 'brands', 'categories_tags', 'quantity',
  'nutriments', 'ingredients_text', 'ingredients_text_pt', 'allergens_tags', 'traces_tags', 'additives_tags',
].join(',');

export function createOffLookup(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): OffLookup {
  return async (barcode) => {
    try {
      const res = await fetchImpl(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${FIELDS}`,
        { signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': 'PomoAI/0.1' } },
      );
      if (res.status === 404) return { kind: 'not_found' };
      if (!res.ok) return { kind: 'error' };
      const product = mapOffProduct(await res.json(), barcode);
      return product ? { kind: 'found', product } : { kind: 'not_found' };
    } catch {
      return { kind: 'error' };
    }
  };
}
