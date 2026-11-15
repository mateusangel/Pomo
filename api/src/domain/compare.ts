import type { Nutrition, Profile, ProductAnalysis } from './types.js';

type NutrientKey = keyof Nutrition;

interface RowSpec {
  key: NutrientKey;
  label: string;
  /** true: menor é melhor (açúcar, sódio...); false: maior é melhor (fibras, proteínas). */
  lowerIsBetter: boolean;
}

const ROWS: RowSpec[] = [
  { key: 'energyKcal', label: 'Energia (kcal)', lowerIsBetter: true },
  { key: 'sugarsG', label: 'Açúcares (g)', lowerIsBetter: true },
  { key: 'addedSugarsG', label: 'Açúcar adicionado (g)', lowerIsBetter: true },
  { key: 'saturatedFatG', label: 'Gordura saturada (g)', lowerIsBetter: true },
  { key: 'sodiumMg', label: 'Sódio (mg)', lowerIsBetter: true },
  { key: 'fiberG', label: 'Fibras (g)', lowerIsBetter: false },
  { key: 'proteinG', label: 'Proteínas (g)', lowerIsBetter: false },
];

export interface ComparisonRow {
  key: NutrientKey;
  label: string;
  /** Valor por produto, na mesma ordem da entrada; null = não informado. */
  values: (number | null)[];
  /** Índice do melhor valor; null se empate ou sem dados suficientes. */
  bestIndex: number | null;
}

export interface Recommendation {
  barcode: string;
  reason: string;
}

export interface Comparison {
  /** Mesma ordem de entrada. */
  scores: { barcode: string; score: number | null }[];
  rows: ComparisonRow[];
  /** Produto que combina com o perfil; null se não houver dados para decidir. */
  recommendation: Recommendation | null;
  /** Aviso quando os produtos são de categorias diferentes. */
  notice?: string;
}

function bestOf(values: (number | null)[], lowerIsBetter: boolean): number | null {
  const known = values
    .map((v, i) => ({ v, i }))
    .filter((x): x is { v: number; i: number } => x.v !== null);
  if (known.length < 2) return null;
  const pick = lowerIsBetter
    ? Math.min(...known.map((x) => x.v))
    : Math.max(...known.map((x) => x.v));
  const winners = known.filter((x) => x.v === pick);
  return winners.length === 1 ? winners[0]!.i : null;
}

/**
 * Compara 2 ou 3 produtos já analisados. A recomendação segue o objetivo do perfil:
 * menos açúcar, menos sódio ou, sem objetivo, a maior nota.
 */
export function compareProducts(analyses: ProductAnalysis[], profile: Profile | null): Comparison {
  const rows: ComparisonRow[] = ROWS.map((r) => {
    const values = analyses.map((a) => a.product.nutrition[r.key] ?? null);
    return { key: r.key, label: r.label, values, bestIndex: bestOf(values, r.lowerIsBetter) };
  });

  const scores = analyses.map((a) => ({
    barcode: a.product.barcode,
    score: a.score.status === 'ok' ? a.score.score : null,
  }));

  const categories = new Set(analyses.map((a) => a.product.category ?? ''));
  const notice =
    categories.size > 1 ? 'Os produtos são de categorias diferentes, então a comparação pode não ser justa.' : undefined;

  return {
    scores,
    rows,
    recommendation: recommend(analyses, profile),
    ...(notice ? { notice } : {}),
  };
}

function recommend(analyses: ProductAnalysis[], profile: Profile | null): Recommendation | null {
  const usable = analyses.filter((a) => a.score.status === 'ok');
  if (usable.length === 0) return null;

  const priorities: { key: NutrientKey; label: string }[] = [];
  if (profile?.lessSugar) priorities.push({ key: 'sugarsG', label: 'menos açúcar' });
  if (profile?.lessSodium) priorities.push({ key: 'sodiumMg', label: 'menos sódio' });

  if (priorities.length > 0) {
    const [{ key, label }] = priorities as [{ key: NutrientKey; label: string }];
    const withValue = usable.filter((a) => a.product.nutrition[key] !== undefined);
    if (withValue.length > 0) {
      const best = withValue.reduce((b, a) => (a.product.nutrition[key]! < b.product.nutrition[key]! ? a : b));
      return {
        barcode: best.product.barcode,
        reason: `Tem o menor valor de ${label.replace('menos ', '')} entre os comparados, que é o que você busca.`,
      };
    }
  }

  const best = usable.reduce((b, a) => (a.score.status === 'ok' && b.score.status === 'ok' && a.score.score > b.score.score ? a : b));
  if (best.score.status !== 'ok') return null;
  return { barcode: best.product.barcode, reason: `Tem a maior nota (${best.score.score}/100) entre os comparados.` };
}
