import { additivePenalty, detectAdditives } from './additives.js';
import { detectAlerts } from './allergens.js';
import { SCORE_VERSION, computeBaseScore } from './score.js';
import type { Product, ProductAnalysis, Profile } from './types.js';

const EMPTY_PROFILE: Profile = {
  goals: [],
  allergens: [],
  restrictions: [],
  lessSugar: false,
  lessSodium: false,
};

/**
 * Análise completa de um produto. O perfil só alimenta os alertas;
 * a nota nunca depende dele.
 */
export function analyzeProduct(product: Product, profile: Profile | null): ProductAnalysis {
  const additives = detectAdditives(product);
  const score = computeBaseScore(product, additivePenalty(additives));
  const alerts = detectAlerts(product, profile ?? EMPTY_PROFILE);
  return { product, score, scoreVersion: SCORE_VERSION, additives, alerts };
}
