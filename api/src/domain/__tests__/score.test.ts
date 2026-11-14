import { describe, expect, it } from 'vitest';
import { computeBaseScore } from '../score.js';
import type { Nutrition, Product } from '../types.js';

function make(nutrition: Nutrition, isLiquid = false): Product {
  return {
    barcode: '7891000100103',
    name: 'Teste',
    isLiquid,
    nutrition,
    allergensTags: [],
    tracesTags: [],
    additivesTags: [],
    source: 'off',
    verified: true,
  };
}

describe('computeBaseScore', () => {
  it('sólido com 15 g de açúcar adicionado → 75 e alerta de açúcar', () => {
    const r = computeBaseScore(
      make({ addedSugarsG: 15, saturatedFatG: 0, sodiumMg: 0 }),
    );
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.score).toBe(75);
    expect(r.warnings.map((w) => w.nutrient)).toContain('acucar_adicionado');
  });

  it('líquido usa limite próprio: 7,5 g tem a mesma penalidade que 15 g sólido', () => {
    const liquid = computeBaseScore(make({ addedSugarsG: 7.5 }, true));
    const solid = computeBaseScore(make({ addedSugarsG: 15 }));
    expect(liquid).toEqual(solid);
    if (liquid.status === 'ok') expect(liquid.score).toBe(75);
  });

  it('usa açúcares totais como aproximação marcada', () => {
    const r = computeBaseScore(make({ sugarsG: 15 }));
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const item = r.breakdown.find((b) => b.approximated);
    expect(item).toBeDefined();
  });

  it('sem nutrientes-chave → dados insuficientes (nunca 0 nem 100)', () => {
    expect(computeBaseScore(make({}))).toEqual({ status: 'insufficient_data' });
    expect(computeBaseScore(make({ fiberG: 9, proteinG: 9 }))).toEqual({
      status: 'insufficient_data',
    });
  });

  it('nunca sai de 0–100', () => {
    const bad = computeBaseScore(
      make({ addedSugarsG: 999, saturatedFatG: 999, sodiumMg: 99999 }),
      20,
    );
    const good = computeBaseScore(
      make({ addedSugarsG: 0, saturatedFatG: 0, sodiumMg: 0, fiberG: 10, proteinG: 20 }),
    );
    expect(bad.status === 'ok' && bad.score).toBe(0);
    expect(good.status === 'ok' && good.score).toBe(100);
  });

  it('é determinístico', () => {
    const p = make({ addedSugarsG: 4, saturatedFatG: 2, sodiumMg: 200 });
    const first = computeBaseScore(p, 3);
    for (let i = 0; i < 100; i++) expect(computeBaseScore(p, 3)).toEqual(first);
  });

  it('faixas', () => {
    const band = (n: Nutrition) => {
      const r = computeBaseScore(make(n));
      return r.status === 'ok' ? r.band : null;
    };
    expect(band({ addedSugarsG: 0, saturatedFatG: 0, sodiumMg: 0 })).toBe('excelente'); // 100
    expect(band({ addedSugarsG: 15, saturatedFatG: 0, sodiumMg: 0 })).toBe('bom'); // 75
    expect(band({ addedSugarsG: 15, saturatedFatG: 0, sodiumMg: 600 })).toBe('regular'); // 50
    expect(band({ addedSugarsG: 15, saturatedFatG: 6, sodiumMg: 600 })).toBe('ruim'); // 25
  });

  it('positivos e negativos em português', () => {
    const r = computeBaseScore(
      make({ sodiumMg: 900, fiberG: 4, proteinG: 6, addedSugarsG: 0 }),
    );
    if (r.status !== 'ok') throw new Error('esperado ok');
    expect(r.positives).toContain('Rico em fibras');
    expect(r.positives).toContain('Fonte de proteínas');
    expect(r.negatives).toContain('Muito sódio');
    expect(r.warnings.map((w) => w.label)).toContain('Alto em sódio');
  });
});
