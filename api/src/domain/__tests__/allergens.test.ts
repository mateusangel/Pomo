import { describe, expect, it } from 'vitest';
import { detectAlerts } from '../allergens.js';
import type { Product, Profile } from '../types.js';

const profile = (p: Partial<Profile>): Profile => ({
  goals: [],
  allergens: [],
  restrictions: [],
  lessSugar: false,
  lessSodium: false,
  ...p,
});

const product = (p: Partial<Product>): Product => ({
  barcode: '7891000100103',
  name: 'Teste',
  isLiquid: false,
  nutrition: {},
  allergensTags: [],
  tracesTags: [],
  additivesTags: [],
  source: 'off',
  verified: true,
  ...p,
});

describe('detectAlerts', () => {
  it('tag do OFF en:milk com perfil leite → contem', () => {
    const r = detectAlerts(product({ allergensTags: ['en:milk'] }), profile({ allergens: ['leite'] }));
    expect(r.alerts).toHaveLength(1);
    expect(r.alerts[0]).toMatchObject({ kind: 'allergen', item: 'leite', level: 'contem' });
  });

  it('"SORO DE LEITE" no texto, sem tags → contem', () => {
    const r = detectAlerts(
      product({ ingredientsText: 'AÇÚCAR, SORO DE LEITE, SAL' }),
      profile({ allergens: ['leite'] }),
    );
    expect(r.alerts[0]?.level).toBe('contem');
  });

  it('traço en:nuts com perfil castanhas → pode_conter', () => {
    const r = detectAlerts(
      product({ ingredientsText: 'farinha', tracesTags: ['en:nuts'] }),
      profile({ allergens: ['castanhas'] }),
    );
    expect(r.alerts[0]).toMatchObject({ item: 'castanhas', level: 'pode_conter' });
  });

  it('"Amêndoas" com perfil castanhas → alerta', () => {
    const r = detectAlerts(
      product({ ingredientsText: 'Amêndoas, mel' }),
      profile({ allergens: ['castanhas'] }),
    );
    expect(r.alerts[0]?.level).toBe('contem');
  });

  it('"Pode conter leite" no texto → pode_conter, não contem', () => {
    const r = detectAlerts(
      product({ ingredientsText: 'açúcar, cacau. Pode conter leite.' }),
      profile({ allergens: ['leite'] }),
    );
    expect(r.alerts[0]?.level).toBe('pode_conter');
  });

  it('sem ingredientes e sem tags → dados incompletos, nunca "seguro"', () => {
    const r = detectAlerts(product({}), profile({ allergens: ['leite'] }));
    expect(r.dataComplete).toBe(false);
    expect(r.notice).toContain('Dados incompletos');
  });

  it('produto limpo e completo → sem alertas', () => {
    const r = detectAlerts(
      product({ ingredientsText: 'arroz, sal' }),
      profile({ allergens: ['leite', 'ovo'] }),
    );
    expect(r).toEqual({ alerts: [], dataComplete: true });
  });

  it('produto de usuário não verificado → aviso', () => {
    const r = detectAlerts(
      product({ source: 'user', verified: false, ingredientsText: 'arroz' }),
      profile({}),
    );
    expect(r.notice).toContain('enviados por usuário');
  });

  it('vegano + gelatina → restrição', () => {
    const r = detectAlerts(
      product({ ingredientsText: 'açúcar, gelatina' }),
      profile({ restrictions: ['vegano'] }),
    );
    expect(r.alerts[0]).toMatchObject({ kind: 'restriction', item: 'vegano' });
  });

  it('vegetariano + leite não gera alerta', () => {
    const r = detectAlerts(
      product({ ingredientsText: 'leite, açúcar' }),
      profile({ restrictions: ['vegetariano'] }),
    );
    expect(r.alerts).toEqual([]);
  });

  it('"leite de coco" e "não contém glúten" não geram falso alerta', () => {
    const r = detectAlerts(
      product({ ingredientsText: 'leite de coco, açúcar. NÃO CONTÉM GLÚTEN.' }),
      profile({ allergens: ['leite', 'gluten'] }),
    );
    expect(r.alerts).toEqual([]);
  });
});
