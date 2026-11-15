import { describe, expect, it } from 'vitest';
import { analyzeProduct } from '../analysis.js';
import { rankAlternatives, MIN_SCORE_GAIN } from '../alternatives.js';
import { compareProducts } from '../compare.js';
import { hasAiAccess } from '../entitlements.js';
import { buildExplainPrompt } from '../explainPrompt.js';
import { labelToProduct, LabelUnreadableError, parseLabelExtraction, type LabelExtraction } from '../labelReading.js';
import { summarizeHistory } from '../stats.js';
import type { Product, Profile } from '../types.js';

const profile = (over: Partial<Profile> = {}): Profile => ({
  goals: [],
  allergens: [],
  restrictions: [],
  lessSugar: false,
  lessSodium: false,
  ...over,
});

const make = (barcode: string, over: Partial<Product> & { nutrition?: Product['nutrition'] } = {}): Product => ({
  barcode,
  name: `Produto ${barcode}`,
  category: 'iogurtes',
  isLiquid: false,
  nutrition: { sugarsG: 4, saturatedFatG: 1, sodiumMg: 60, proteinG: 6, fiberG: 1 },
  ingredientsText: 'leite, fermentos lácteos',
  allergensTags: [],
  tracesTags: [],
  additivesTags: [],
  source: 'off',
  verified: true,
  ...over,
});

describe('compareProducts', () => {
  it('recomenda o de menos açúcar quando o perfil quer menos açúcar', () => {
    const a = analyzeProduct(make('1', { nutrition: { sugarsG: 20, sodiumMg: 50 } }), null);
    const b = analyzeProduct(make('2', { nutrition: { sugarsG: 3, sodiumMg: 50 } }), null);
    const cmp = compareProducts([a, b], profile({ lessSugar: true }));
    expect(cmp.recommendation?.barcode).toBe('2');
  });

  it('sem objetivo, recomenda a maior nota', () => {
    const ruim = analyzeProduct(make('1', { nutrition: { sugarsG: 30, sodiumMg: 900 } }), null);
    const boa = analyzeProduct(make('2', { nutrition: { sugarsG: 2, sodiumMg: 40, proteinG: 8 } }), null);
    expect(compareProducts([ruim, boa], null).recommendation?.barcode).toBe('2');
  });

  it('marca o melhor valor de cada linha e deixa null em empate', () => {
    const a = analyzeProduct(make('1', { nutrition: { sugarsG: 5, sodiumMg: 100 } }), null);
    const b = analyzeProduct(make('2', { nutrition: { sugarsG: 5, sodiumMg: 50 } }), null);
    const cmp = compareProducts([a, b], null);
    expect(cmp.rows.find((r) => r.key === 'sugarsG')?.bestIndex).toBeNull();
    expect(cmp.rows.find((r) => r.key === 'sodiumMg')?.bestIndex).toBe(1);
  });

  it('avisa quando as categorias são diferentes', () => {
    const a = analyzeProduct(make('1', { category: 'iogurtes' }), null);
    const b = analyzeProduct(make('2', { category: 'biscoitos' }), null);
    expect(compareProducts([a, b], null).notice).toBeDefined();
  });
});

describe('rankAlternatives', () => {
  const ruim = analyzeProduct(make('ruim', { nutrition: { addedSugarsG: 25, sodiumMg: 800, saturatedFatG: 8 } }), null);

  it('não sugere nada quando o produto atual não é ruim', () => {
    const boa = analyzeProduct(make('boa'), null);
    expect(boa.score.status === 'ok' && boa.score.score).toBeGreaterThanOrEqual(60);
    expect(rankAlternatives(boa, [ruim], null)).toEqual([]);
  });

  it('só traz produtos da mesma categoria, com nota melhor e dados completos', () => {
    const boa = analyzeProduct(make('boa', { nutrition: { sugarsG: 2, sodiumMg: 40 } }), null);
    const outraCategoria = analyzeProduct(make('outra', { category: 'biscoitos' }), null);
    const alt = analyzeProduct(make('alt', { nutrition: { sugarsG: 1, sodiumMg: 30 } }), null);
    const result = rankAlternatives(ruim, [boa, outraCategoria, alt], null);
    expect(result.map((r) => r.analysis.product.barcode)).toEqual(['alt', 'boa']);
    expect(result.every((r) => r.scoreGain >= MIN_SCORE_GAIN)).toBe(true);
  });

  it('nunca sugere produto com alérgeno do usuário', () => {
    // As rotas analisam os candidatos com o perfil do usuário; o teste faz o mesmo.
    const alergico = profile({ allergens: ['leite'] });
    const comLeite = analyzeProduct(
      make('leite', { nutrition: { sugarsG: 1, sodiumMg: 30 }, allergensTags: ['en:milk'] }),
      alergico,
    );
    expect(comLeite.alerts.alerts.some((a) => a.level === 'contem')).toBe(true);
    expect(rankAlternatives(ruim, [comLeite], alergico)).toEqual([]);
  });

  it('ignora produtos com dados insuficientes', () => {
    const semDados = analyzeProduct(make('vazio', { nutrition: {} }), null);
    expect(rankAlternatives(ruim, [semDados], null)).toEqual([]);
  });
});

describe('summarizeHistory', () => {
  const now = new Date('2026-11-14T12:00:00Z');
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  it('conta só o período e estima açúcar e sódio por registro (100 g)', () => {
    const p = analyzeProduct(make('x', { nutrition: { addedSugarsG: 10, sodiumMg: 200 } }), null);
    const old = analyzeProduct(make('y', { nutrition: { addedSugarsG: 50, sodiumMg: 900 } }), null);
    const stats = summarizeHistory(
      [
        { analysis: p, scannedAt: daysAgo(1) },
        { analysis: p, scannedAt: daysAgo(2) },
        { analysis: old, scannedAt: daysAgo(40) },
      ],
      now,
      30,
    );
    expect(stats.totalScans).toBe(2);
    expect(stats.estimatedSugarG).toBe(20);
    expect(stats.estimatedSodiumMg).toBe(400);
    expect(stats.uniqueProducts).toBe(1);
  });

  it('tendência fica "sem_dados" com menos de 4 registros pontuados', () => {
    const p = analyzeProduct(make('x'), null);
    expect(summarizeHistory([{ analysis: p, scannedAt: daysAgo(1) }], now, 30).trend).toBe('sem_dados');
  });

  it('detecta queda da nota entre a primeira e a segunda metade', () => {
    const boa = analyzeProduct(make('boa', { nutrition: { sugarsG: 1, sodiumMg: 20 } }), null);
    const ruim = analyzeProduct(make('ruim', { nutrition: { sugarsG: 30, sodiumMg: 900 } }), null);
    const entries = [
      { analysis: boa, scannedAt: daysAgo(10) },
      { analysis: boa, scannedAt: daysAgo(9) },
      { analysis: ruim, scannedAt: daysAgo(2) },
      { analysis: ruim, scannedAt: daysAgo(1) },
    ];
    expect(summarizeHistory(entries, now, 30).trend).toBe('caiu');
  });
});

describe('leitura de rótulo', () => {
  const base: LabelExtraction = {
    name: 'Iogurte Natural',
    brand: null,
    isLiquid: false,
    per: '100',
    servingSize: null,
    nutrition: {
      energyKcal: 60,
      sugarsG: 5,
      addedSugarsG: null,
      saturatedFatG: 2,
      sodiumMg: 70,
      fiberG: null,
      proteinG: 4,
    },
    ingredientsText: 'leite, fermentos lácteos',
  };

  it('JSON inválido ou fora do formato → LabelUnreadableError', () => {
    expect(() => parseLabelExtraction('isto não é json')).toThrow(LabelUnreadableError);
    expect(() => parseLabelExtraction('{"name": 5}')).toThrow(LabelUnreadableError);
  });

  it('valores por 100 g passam direto e o produto nasce como dado de usuário não verificado', () => {
    const p = labelToProduct(base, 'user:abc');
    expect(p.nutrition).toEqual({ energyKcal: 60, sugarsG: 5, saturatedFatG: 2, sodiumMg: 70, proteinG: 4 });
    expect(p.source).toBe('user');
    expect(p.verified).toBe(false);
  });

  it('valores por porção são convertidos para 100 g pela porção informada', () => {
    const p = labelToProduct({ ...base, per: 'porcao', servingSize: 30, nutrition: { ...base.nutrition, sugarsG: 5 } }, 'user:abc');
    expect(p.nutrition.sugarsG).toBe(16.7);
  });

  it('porção sem tamanho não converte; sem nenhum valor → LabelUnreadableError', () => {
    const semPorcao = { ...base, per: 'porcao' as const, servingSize: null };
    expect(() => labelToProduct(semPorcao, 'user:abc')).toThrow(LabelUnreadableError);
  });
});

describe('explicação por IA', () => {
  it('monta o prompt do módulo com os dados da tela e as regras do app', () => {
    const a = analyzeProduct(make('1', { name: 'Iogurte Teste' }), null);
    const { system, prompt } = buildExplainPrompt({ module: 'produto', profile: null, product: a });
    expect(system).toContain('Iogurte Teste');
    expect(system).toContain('nunca altera');
    expect(system).toContain('Explique o que está acontecendo com este produto');
    expect(prompt).toBeTruthy();
  });

  it('está liberada para todos enquanto a assinatura não existe', () => {
    expect(hasAiAccess('gratis')).toBe(true);
    expect(hasAiAccess('plus')).toBe(true);
  });
});
