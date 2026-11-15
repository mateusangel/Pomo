import type { Product } from './types.js';

/** O que falta num produto para ter nota e alertas confiáveis. */
export interface Missing {
  /** Sem açúcar, gordura saturada nem sódio: não dá para calcular a nota. */
  nutrition: boolean;
  /** Sem lista de ingredientes e sem tags de alérgenos: os alertas ficam "incompletos". */
  ingredients: boolean;
}

export function missingData(p: Product): Missing {
  const n = p.nutrition;
  const hasScoreInputs =
    n.sugarsG !== undefined || n.addedSugarsG !== undefined || n.saturatedFatG !== undefined || n.sodiumMg !== undefined;
  const hasIngredients = !!p.ingredientsText && p.ingredientsText.trim() !== '';
  return { nutrition: !hasScoreInputs, ingredients: !hasIngredients && p.allergensTags.length === 0 };
}

export function isIncomplete(p: Product): boolean {
  const m = missingData(p);
  return m.nutrition || m.ingredients;
}

/** Pontuação simples de quanta informação o produto tem; serve para comparar duas versões do mesmo produto. */
export function completenessScore(p: Product): number {
  const hasIngredients = !!p.ingredientsText && p.ingredientsText.trim() !== '';
  return Object.keys(p.nutrition).length + (hasIngredients ? 3 : 0) + (p.allergensTags.length > 0 ? 1 : 0);
}
