import { describe, expect, it } from 'vitest';
import { ADDITIVE_DICTIONARY, additivePenalty, detectAdditives } from '../additives.js';

const none = { ingredientsText: undefined, additivesTags: [] as string[] };

describe('detectAdditives', () => {
  it('encontra aspartame pela tag en:e951', () => {
    const r = detectAdditives({ ...none, additivesTags: ['en:e951'] });
    expect(r.map((a) => a.name)).toEqual(['Aspartame']);
  });
  it('encontra tartrazina por "INS 102" no texto', () => {
    const r = detectAdditives({ ...none, ingredientsText: 'água, corante INS 102' });
    expect(r.map((a) => a.code)).toEqual(['E102']);
  });
  it('detecta nome em maiúsculas', () => {
    const r = detectAdditives({ ...none, ingredientsText: 'ADOÇANTE: ASPARTAME' });
    expect(r.map((a) => a.code)).toEqual(['E951']);
  });
  it('mesmo aditivo por tag e texto aparece uma vez', () => {
    const r = detectAdditives({ ingredientsText: 'contém aspartame, E951', additivesTags: ['en:e951'] });
    expect(r).toHaveLength(1);
  });
  it('a conjunção "e" seguida de número não vira código', () => {
    expect(detectAdditives({ ...none, ingredientsText: 'sal e 100 g de farinha' })).toEqual([]);
  });
  it('todo item tem explicação e fonte', () => {
    for (const a of ADDITIVE_DICTIONARY) {
      expect(a.explanation.length).toBeGreaterThan(0);
      expect(a.source.length).toBeGreaterThan(0);
      expect(a.penalty).toBeGreaterThanOrEqual(0);
      expect(a.penalty).toBeLessThanOrEqual(10);
    }
  });
  it('penalidade total limitada a 20', () => {
    const ten = { ...ADDITIVE_DICTIONARY[0]!, penalty: 10 };
    expect(additivePenalty([ten, ten, ten, ten, ten])).toBe(20);
    expect(additivePenalty([])).toBe(0);
  });
});
