/** Valores por 100 g (sólidos) ou 100 ml (líquidos). */
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

export type Band = 'excelente' | 'bom' | 'regular' | 'ruim';

export interface Warning {
  nutrient: 'acucar_adicionado' | 'gordura_saturada' | 'sodio';
  label: string;
}

export interface BreakdownItem {
  label: string;
  points: number;
  approximated?: boolean;
}

export type ScoreResult =
  | {
      status: 'ok';
      score: number;
      band: Band;
      warnings: Warning[];
      positives: string[];
      negatives: string[];
      breakdown: BreakdownItem[];
    }
  | { status: 'insufficient_data' };

export type Allergen =
  | 'leite'
  | 'ovo'
  | 'trigo'
  | 'soja'
  | 'amendoim'
  | 'castanhas'
  | 'peixe'
  | 'crustaceos'
  | 'gluten'
  | 'lactose';

export type Restriction = 'vegetariano' | 'vegano';

export interface Profile {
  goals: string[];
  allergens: Allergen[];
  restrictions: Restriction[];
  lessSugar: boolean;
  lessSodium: boolean;
}

export interface AllergenAlert {
  kind: 'allergen' | 'restriction';
  item: string;
  level: 'contem' | 'pode_conter';
  reason: string;
}

export interface AlertReport {
  alerts: AllergenAlert[];
  dataComplete: boolean;
  notice?: string;
}

export interface AdditiveInfo {
  code: string;
  name: string;
  category: 'corante' | 'conservante' | 'adocante' | 'realcador' | 'outro';
  penalty: number;
  explanation: string;
  source: string;
}

export interface ProductAnalysis {
  product: Product;
  score: ScoreResult;
  scoreVersion: string;
  additives: AdditiveInfo[];
  alerts: AlertReport;
}
