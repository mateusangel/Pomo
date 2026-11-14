import { describe, expect, it } from 'vitest';
import { analyzeProduct } from '../analysis.js';
import type { Product, Profile } from '../types.js';

const base: Product = {
  barcode: '7891000100103',
  name: 'Bebida láctea',
  isLiquid: true,
  nutrition: { addedSugarsG: 5, saturatedFatG: 1, sodiumMg: 50 },
  ingredientsText: 'leite, açúcar, aspartame',
  allergensTags: ['en:milk'],
  tracesTags: [],
  additivesTags: [],
  source: 'off',
  verified: true,
};

const allergic: Profile = {
  goals: [],
  allergens: ['leite'],
  restrictions: [],
  lessSugar: true,
  lessSodium: true,
};

describe('analyzeProduct', () => {
  it('perfil alérgico gera alerta mas não altera a nota', () => {
    const withProfile = analyzeProduct(base, allergic);
    const without = analyzeProduct(base, null);
    expect(withProfile.alerts.alerts.length).toBeGreaterThan(0);
    expect(without.alerts.alerts).toEqual([]);
    expect(withProfile.score).toEqual(without.score);
    expect(withProfile.scoreVersion).toBe('1');
  });

  it('aditivos penalizam a nota', () => {
    const clean = analyzeProduct({ ...base, ingredientsText: 'leite, açúcar' }, null);
    const withAdd = analyzeProduct(base, null);
    if (clean.score.status !== 'ok' || withAdd.score.status !== 'ok') throw new Error('ok esperado');
    expect(withAdd.score.score).toBe(clean.score.score - 5);
    expect(withAdd.additives.map((a) => a.code)).toEqual(['E951']);
  });
});
