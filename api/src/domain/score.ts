import type {
  Band,
  BreakdownItem,
  Product,
  ScoreResult,
  Warning,
} from './types.js';

/** Incrementar quando a fórmula mudar (permite reprocessar notas salvas). */
export const SCORE_VERSION = '1';

/** Limites da lupa ANVISA (RDC 429/2020, IN 75/2020) por 100 g / 100 ml. */
const LIMITS = {
  solid: { sugar: 15, satFat: 6, sodium: 600 },
  liquid: { sugar: 7.5, satFat: 3, sodium: 300 },
} as const;

const MAX_NUTRIENT_PENALTY = 30;
const PENALTY_FACTOR = 25;
const MAX_ADDITIVE_PENALTY = 20;

function nutrientPenalty(value: number, limit: number): number {
  return Math.min(MAX_NUTRIENT_PENALTY, Math.round(PENALTY_FACTOR * (value / limit)));
}

function bandFor(score: number): Band {
  if (score >= 80) return 'excelente';
  if (score >= 60) return 'bom';
  if (score >= 40) return 'regular';
  return 'ruim';
}

/**
 * Nota base 0–100, determinística e sem IA. Não recebe perfil de propósito:
 * preferências do usuário nunca alteram a nota.
 */
export function computeBaseScore(product: Product, additivePenalty = 0): ScoreResult {
  const n = product.nutrition;
  const limits = product.isLiquid ? LIMITS.liquid : LIMITS.solid;

  const sugarApproximated = n.addedSugarsG === undefined && n.sugarsG !== undefined;
  const sugar = n.addedSugarsG ?? n.sugarsG;

  if (sugar === undefined && n.saturatedFatG === undefined && n.sodiumMg === undefined) {
    return { status: 'insufficient_data' };
  }

  let score = 100;
  const warnings: Warning[] = [];
  const positives: string[] = [];
  const negatives: string[] = [];
  const breakdown: BreakdownItem[] = [];

  if (sugar !== undefined) {
    const p = nutrientPenalty(sugar, limits.sugar);
    score -= p;
    breakdown.push({
      label: 'Açúcar',
      points: -p,
      ...(sugarApproximated ? { approximated: true } : {}),
    });
    if (sugar >= limits.sugar) {
      warnings.push({ nutrient: 'acucar_adicionado', label: 'Alto em açúcar adicionado' });
      negatives.push('Muito açúcar');
    }
  }

  if (n.saturatedFatG !== undefined) {
    const p = nutrientPenalty(n.saturatedFatG, limits.satFat);
    score -= p;
    breakdown.push({ label: 'Gordura saturada', points: -p });
    if (n.saturatedFatG >= limits.satFat) {
      warnings.push({ nutrient: 'gordura_saturada', label: 'Alto em gordura saturada' });
      negatives.push('Muita gordura saturada');
    }
  }

  if (n.sodiumMg !== undefined) {
    const p = nutrientPenalty(n.sodiumMg, limits.sodium);
    score -= p;
    breakdown.push({ label: 'Sódio', points: -p });
    if (n.sodiumMg >= limits.sodium) {
      warnings.push({ nutrient: 'sodio', label: 'Alto em sódio' });
      negatives.push('Muito sódio');
    }
  }

  if (n.fiberG !== undefined && n.fiberG >= 3) {
    score += 5;
    breakdown.push({ label: 'Fibras', points: 5 });
    positives.push('Rico em fibras');
  }
  if (n.proteinG !== undefined && n.proteinG >= 5) {
    score += 5;
    breakdown.push({ label: 'Proteínas', points: 5 });
    positives.push('Fonte de proteínas');
  }

  const addPenalty = Math.min(MAX_ADDITIVE_PENALTY, Math.max(0, additivePenalty));
  if (addPenalty > 0) {
    score -= addPenalty;
    breakdown.push({ label: 'Aditivos', points: -addPenalty });
    negatives.push('Contém aditivos');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    status: 'ok',
    score,
    band: bandFor(score),
    warnings,
    positives,
    negatives,
    breakdown,
  };
}
