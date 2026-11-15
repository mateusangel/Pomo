import { describe, expect, it } from 'vitest';
import { createOffLookup, mapOffProduct } from '../off.js';

const code = '7891000100103';
const off = (product: Record<string, unknown>) => ({ status: 1, product });

describe('mapOffProduct', () => {
  it('sódio em gramas vira mg', () => {
    const p = mapOffProduct(off({ product_name: 'X', nutriments: { sodium_100g: 0.4 } }), code);
    expect(p?.nutrition.sodiumMg).toBe(400);
  });
  it('só sal: sódio = sal × 400', () => {
    const p = mapOffProduct(off({ product_name: 'X', nutriments: { salt_100g: 1 } }), code);
    expect(p?.nutrition.sodiumMg).toBe(400);
  });
  it('detecta líquido por quantidade e por categoria', () => {
    expect(mapOffProduct(off({ product_name: 'Coca-Cola 350 ml', quantity: '350 ml' }), code)?.isLiquid).toBe(true);
    expect(mapOffProduct(off({ product_name: 'Suco', categories_tags: ['en:beverages'] }), code)?.isLiquid).toBe(true);
    expect(mapOffProduct(off({ product_name: 'Arroz', quantity: '1 kg' }), code)?.isLiquid).toBe(false);
  });
  it('status 0, sem produto ou sem nome → null', () => {
    expect(mapOffProduct({ status: 0 }, code)).toBeNull();
    expect(mapOffProduct({ status: 1 }, code)).toBeNull();
    expect(mapOffProduct(off({ nutriments: {} }), code)).toBeNull();
    expect(mapOffProduct('lixo', code)).toBeNull();
  });
  it('campos ausentes não viram 0', () => {
    const p = mapOffProduct(off({ product_name: 'X', nutriments: { sugars_100g: 3 } }), code);
    expect(p?.nutrition).toEqual({ sugarsG: 3 });
  });
  it('sem valores por 100 g, converte pela porção', () => {
    const p = mapOffProduct(
      off({ product_name: 'X', serving_quantity: '30', nutriments: { sugars_serving: 6, sodium_serving: 0.12, proteins_serving: 1.5 } }),
      code,
    );
    expect(p?.nutrition).toEqual({ sugarsG: 20, sodiumMg: 400, proteinG: 5 });
  });
  it('sem kcal, converte a energia de kJ', () => {
    const p = mapOffProduct(off({ product_name: 'X', nutriments: { energy_100g: 1046 } }), code);
    expect(p?.nutrition.energyKcal).toBe(250);
  });
  it('porção sem tamanho conhecido não inventa valor', () => {
    const p = mapOffProduct(off({ product_name: 'X', nutriments: { sugars_serving: 6 } }), code);
    expect(p?.nutrition).toEqual({});
  });
  it('ingredientes: português, depois qualquer idioma, depois a lista estruturada', () => {
    expect(mapOffProduct(off({ product_name: 'X', ingredients_text_pt: 'leite', ingredients_text_en: 'milk' }), code)?.ingredientsText).toBe('leite');
    expect(mapOffProduct(off({ product_name: 'X', ingredients_text_en: 'milk, sugar' }), code)?.ingredientsText).toBe('milk, sugar');
    expect(mapOffProduct(off({ product_name: 'X', ingredients: [{ text: 'leite' }, { text: 'açúcar' }] }), code)?.ingredientsText).toBe('leite, açúcar');
  });
  it('copia tags e marca como verificado do OFF', () => {
    const p = mapOffProduct(
      off({ product_name: 'X', allergens_tags: ['en:milk'], traces_tags: ['en:nuts'], additives_tags: ['en:e951'] }),
      code,
    );
    expect(p).toMatchObject({ allergensTags: ['en:milk'], tracesTags: ['en:nuts'], additivesTags: ['en:e951'], source: 'off', verified: true });
  });
});

describe('createOffLookup', () => {
  const json = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });

  it('encontra produto', async () => {
    const r = await createOffLookup(json(off({ product_name: 'X' })) as typeof fetch)(code);
    expect(r.kind).toBe('found');
  });
  it('404 → not_found', async () => {
    expect((await createOffLookup(json({}, 404) as typeof fetch)(code)).kind).toBe('not_found');
  });
  it('se o primeiro servidor falhar, tenta o segundo', async () => {
    let calls = 0;
    const flaky = (async (url: string) => {
      calls += 1;
      if (String(url).includes('world.')) throw new Error('fora do ar');
      return new Response(JSON.stringify(off({ product_name: 'X' })), { status: 200 });
    }) as unknown as typeof fetch;
    expect((await createOffLookup(flaky)(code)).kind).toBe('found');
    expect(calls).toBe(2);
  });
  it('500 e falha de rede → error', async () => {
    expect((await createOffLookup(json({}, 500) as typeof fetch)(code)).kind).toBe('error');
    const boom = (async () => { throw new Error('rede'); }) as typeof fetch;
    expect((await createOffLookup(boom)(code)).kind).toBe('error');
  });
});
