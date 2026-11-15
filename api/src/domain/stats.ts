import type { ProductAnalysis } from './types.js';

/**
 * Sem porção informada, cada registro é estimado como 100 g (ou 100 ml).
 * O app deve exibir isso como estimativa.
 */
export const ESTIMATE_BASIS = 100;

export interface HistoryEntry {
  analysis: ProductAnalysis;
  scannedAt: Date;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD (UTC)
  scans: number;
  sugarG: number;
  sodiumMg: number;
}

export interface StatsSummary {
  days: number;
  totalScans: number;
  uniqueProducts: number;
  averageScore: number | null;
  bandCounts: Record<'excelente' | 'bom' | 'regular' | 'ruim' | 'sem_nota', number>;
  estimatedSugarG: number;
  estimatedSodiumMg: number;
  daily: DailyPoint[];
  /** Mudança de nota média entre a primeira e a segunda metade do período. */
  trend: 'subiu' | 'caiu' | 'estavel' | 'sem_dados';
  trendDelta: number | null;
  /** Produtos ruins mais registrados (até 3). */
  frequentBad: { barcode: string; name: string; count: number }[];
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Resume o histórico dos últimos `days` dias a partir de `now`. */
export function summarizeHistory(entries: HistoryEntry[], now: Date, days: number): StatsSummary {
  const since = now.getTime() - days * 24 * 60 * 60 * 1000;
  const inRange = entries
    .filter((e) => e.scannedAt.getTime() >= since && e.scannedAt.getTime() <= now.getTime())
    .sort((a, b) => a.scannedAt.getTime() - b.scannedAt.getTime());

  const bandCounts: StatsSummary['bandCounts'] = { excelente: 0, bom: 0, regular: 0, ruim: 0, sem_nota: 0 };
  const dailyMap = new Map<string, DailyPoint>();
  const badCounts = new Map<string, { name: string; count: number }>();
  const scored: { t: number; score: number }[] = [];
  let sugar = 0;
  let sodium = 0;

  for (const e of inRange) {
    const { analysis } = e;
    const n = analysis.product.nutrition;
    const s = analysis.score;
    if (s.status === 'ok') {
      bandCounts[s.band] += 1;
      scored.push({ t: e.scannedAt.getTime(), score: s.score });
    } else {
      bandCounts.sem_nota += 1;
    }

    const sugarG = ((n.addedSugarsG ?? n.sugarsG) ?? 0) * (ESTIMATE_BASIS / 100);
    const sodiumMg = (n.sodiumMg ?? 0) * (ESTIMATE_BASIS / 100);
    sugar += sugarG;
    sodium += sodiumMg;

    const key = dayKey(e.scannedAt);
    const day = dailyMap.get(key) ?? { date: key, scans: 0, sugarG: 0, sodiumMg: 0 };
    day.scans += 1;
    day.sugarG += sugarG;
    day.sodiumMg += sodiumMg;
    dailyMap.set(key, day);

    if (s.status === 'ok' && s.band === 'ruim') {
      const prev = badCounts.get(analysis.product.barcode) ?? { name: analysis.product.name, count: 0 };
      badCounts.set(analysis.product.barcode, { name: prev.name, count: prev.count + 1 });
    }
  }

  const averageScore = scored.length ? round1(avg(scored.map((x) => x.score))) : null;
  const { trend, trendDelta } = computeTrend(scored);

  return {
    days,
    totalScans: inRange.length,
    uniqueProducts: new Set(inRange.map((e) => e.analysis.product.barcode)).size,
    averageScore,
    bandCounts,
    estimatedSugarG: round1(sugar),
    estimatedSodiumMg: Math.round(sodium),
    daily: [...dailyMap.values()].map((d) => ({ ...d, sugarG: round1(d.sugarG), sodiumMg: Math.round(d.sodiumMg) })),
    trend,
    trendDelta,
    frequentBad: [...badCounts.entries()]
      .map(([barcode, v]) => ({ barcode, ...v }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3),
  };
}

function computeTrend(scored: { t: number; score: number }[]): Pick<StatsSummary, 'trend' | 'trendDelta'> {
  if (scored.length < 4) return { trend: 'sem_dados', trendDelta: null };
  const mid = Math.floor(scored.length / 2);
  const delta = round1(avg(scored.slice(mid).map((x) => x.score)) - avg(scored.slice(0, mid).map((x) => x.score)));
  if (delta >= 3) return { trend: 'subiu', trendDelta: delta };
  if (delta <= -3) return { trend: 'caiu', trendDelta: delta };
  return { trend: 'estavel', trendDelta: delta };
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
