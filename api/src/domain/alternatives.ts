import type { Profile, ProductAnalysis } from './types.js';

export interface Alternative {
  analysis: ProductAnalysis;
  /** Diferença de nota em relação ao produto atual (positiva = melhor). */
  scoreGain: number;
  /** Motivo curto em português, pronto para exibir. */
  reason: string;
}

/** Só sugerimos alternativas com nota pelo menos este número de pontos maior. */
export const MIN_SCORE_GAIN = 5;

/** Produto abaixo desta nota é considerado ruim e recebe alternativas. */
export const BAD_SCORE_THRESHOLD = 60;

/**
 * Alternativas da mesma categoria, com dados completos, sem alérgeno do usuário e com nota melhor.
 * Preço não entra: o catálogo ainda não tem dados de preço.
 */
export function rankAlternatives(
  current: ProductAnalysis,
  candidates: ProductAnalysis[],
  profile: Profile | null,
  limit = 5,
): Alternative[] {
  if (current.score.status !== 'ok') return [];
  const base = current.score.score;
  const category = current.product.category;
  const priorities = profile?.lessSugar || profile?.lessSodium;

  return candidates
    .filter((c) => c.product.barcode !== current.product.barcode)
    .filter((c) => category !== undefined && c.product.category === category)
    .filter((c) => c.score.status === 'ok' && c.alerts.dataComplete)
    .filter((c) => !c.alerts.alerts.some((a) => a.level === 'contem'))
    .map((c) => {
      const score = c.score.status === 'ok' ? c.score.score : 0;
      return { analysis: c, scoreGain: score - base, reason: reasonFor(c, profile) };
    })
    .filter((alt) => alt.scoreGain >= MIN_SCORE_GAIN)
    .sort((a, b) => {
      if (b.scoreGain !== a.scoreGain) return b.scoreGain - a.scoreGain;
      if (priorities) return sugarSodiumScore(a.analysis, profile) - sugarSodiumScore(b.analysis, profile);
      return 0;
    })
    .slice(0, limit);
}

function sugarSodiumScore(a: ProductAnalysis, profile: Profile | null): number {
  const n = a.product.nutrition;
  let total = 0;
  if (profile?.lessSugar) total += (n.addedSugarsG ?? n.sugarsG ?? 0) / 10;
  if (profile?.lessSodium) total += (n.sodiumMg ?? 0) / 600;
  return total;
}

function reasonFor(c: ProductAnalysis, profile: Profile | null): string {
  const n = c.product.nutrition;
  if (profile?.lessSugar && n.addedSugarsG !== undefined && n.addedSugarsG < 5) return 'Pouco açúcar adicionado';
  if (profile?.lessSodium && n.sodiumMg !== undefined && n.sodiumMg < 300) return 'Pouco sódio';
  if (c.score.status === 'ok' && c.score.positives.length > 0) return c.score.positives[0]!;
  return 'Nota melhor na mesma categoria';
}
