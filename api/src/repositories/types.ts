import type { Product, Profile } from '../domain/types.js';

export interface ProductRepository {
  findByBarcode(barcode: string): Promise<Product | null>;
  /** Idempotente: o mesmo barcode nunca duplica. */
  upsert(product: Product): Promise<void>;
  searchByName(query: string, limit: number): Promise<Product[]>;
  /** Produtos da mesma categoria (catálogo compartilhado, sem dados de usuário). */
  listByCategory(category: string, limit: number): Promise<Product[]>;
}

export interface FavoriteItem {
  product: Product;
  addedAt: Date;
}

/** Listas de compras: sempre filtradas por userId (vindo do JWT). */
export interface FavoriteRepository {
  list(userId: string): Promise<FavoriteItem[]>;
  add(userId: string, barcode: string): Promise<void>;
  remove(userId: string, barcode: string): Promise<void>;
}

export interface StoredProfile {
  profile: Profile;
  consentAt: Date | null;
}

/** Todo método recebe `userId` do JWT; nunca de entrada do cliente. */
export interface ProfileRepository {
  get(userId: string): Promise<StoredProfile | null>;
  upsert(userId: string, profile: Profile, consentAt: Date | null): Promise<void>;
}

export interface HistoryItem {
  product: Product;
  scannedAt: Date;
}

export interface HistoryRepository {
  add(userId: string, barcode: string): Promise<void>;
  list(userId: string, limit: number): Promise<HistoryItem[]>;
}

export interface Repositories {
  products: ProductRepository;
  profiles: ProfileRepository;
  history: HistoryRepository;
  favorites: FavoriteRepository;
}
