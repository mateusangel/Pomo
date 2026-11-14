import type { Product, Profile } from '../domain/types.js';

export interface ProductRepository {
  findByBarcode(barcode: string): Promise<Product | null>;
  /** Idempotente: o mesmo barcode nunca duplica. */
  upsert(product: Product): Promise<void>;
  searchByName(query: string, limit: number): Promise<Product[]>;
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
}
