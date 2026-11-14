// Espelha os tipos de api/src/domain/types.ts. Será gerado do OpenAPI quando a API estiver no ar.
import type { Band } from '../theme';

export interface Nutrition {
  energyKcal?: number;
  sugarsG?: number;
  addedSugarsG?: number;
  saturatedFatG?: number;
  sodiumMg?: number;
  fiberG?: number;
  proteinG?: number;
}

export interface Product {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  isLiquid: boolean;
  nutrition: Nutrition;
  ingredientsText?: string;
  allergensTags: string[];
  tracesTags: string[];
  additivesTags: string[];
  source: 'off' | 'user';
  verified: boolean;
}

export interface AllergenAlert {
  kind: 'allergen' | 'restriction';
  item: string;
  level: 'contem' | 'pode_conter';
  reason: string;
}

export interface AdditiveInfo {
  code: string;
  name: string;
  category: 'corante' | 'conservante' | 'adocante' | 'realcador' | 'outro';
  penalty: number;
  explanation: string;
  source: string;
}

export type ScoreResult =
  | {
      status: 'ok';
      score: number;
      band: Band;
      warnings: { nutrient: string; label: string }[];
      positives: string[];
      negatives: string[];
      breakdown: { label: string; points: number; approximated?: boolean }[];
    }
  | { status: 'insufficient_data' };

export interface ProductAnalysis {
  product: Product;
  score: ScoreResult;
  scoreVersion: string;
  additives: AdditiveInfo[];
  alerts: { alerts: AllergenAlert[]; dataComplete: boolean; notice?: string };
}

export type AllergenId =
  | 'leite' | 'ovo' | 'trigo' | 'soja' | 'amendoim' | 'castanhas' | 'peixe' | 'crustaceos' | 'gluten' | 'lactose';
export type RestrictionId = 'vegetariano' | 'vegano';

export interface ProfileData {
  goals: string[];
  allergens: AllergenId[];
  restrictions: RestrictionId[];
  lessSugar: boolean;
  lessSodium: boolean;
}

export interface ProfileResponse {
  profile: ProfileData | null;
  consentAt: string | null;
}

export interface HistoryItem {
  product: Product;
  analysis: ProductAnalysis;
  scannedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
