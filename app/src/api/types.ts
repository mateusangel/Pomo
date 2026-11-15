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

export interface Alternative {
  analysis: ProductAnalysis;
  scoreGain: number;
  reason: string;
}

export interface AlternativesResponse {
  current: ProductAnalysis;
  /** false quando o produto não é ruim: o app não mostra a seção. */
  shown: boolean;
  alternatives: Alternative[];
}

export interface ComparisonRow {
  key: keyof Nutrition;
  label: string;
  values: (number | null)[];
  bestIndex: number | null;
}

export interface Comparison {
  scores: { barcode: string; score: number | null }[];
  rows: ComparisonRow[];
  recommendation: { barcode: string; reason: string } | null;
  notice?: string;
}

export interface CompareResponse {
  products: ProductAnalysis[];
  comparison: Comparison;
}

export interface StatsSummary {
  days: number;
  totalScans: number;
  uniqueProducts: number;
  averageScore: number | null;
  bandCounts: Record<'excelente' | 'bom' | 'regular' | 'ruim' | 'sem_nota', number>;
  estimatedSugarG: number;
  estimatedSodiumMg: number;
  daily: { date: string; scans: number; sugarG: number; sodiumMg: number }[];
  trend: 'subiu' | 'caiu' | 'estavel' | 'sem_dados';
  trendDelta: number | null;
  frequentBad: { barcode: string; name: string; count: number }[];
}

export interface FavoriteItem {
  product: Product;
  analysis: ProductAnalysis;
  addedAt: string;
  suggestion: Alternative | null;
}

export type ExplainModule = 'produto' | 'historico' | 'evolucao' | 'comparacao' | 'alternativas' | 'listas';

export interface ExplainRequest {
  module: ExplainModule;
  barcode?: string;
  barcodes?: string[];
  days?: number;
}

export interface LabelImage {
  mimeType: 'image/jpeg';
  data: string;
}
