import { SignJWT } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import type { Product, Profile } from '../../domain/types.js';
import type { ChatModel, VisionModel } from '../../integrations/gemini.js';
import type { OffLookup } from '../../integrations/off.js';
import { createTokenVerifier } from '../../plugins/auth.js';
import type { Repositories, StoredProfile } from '../../repositories/types.js';
import { buildServer } from '../../server.js';

const SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';
const verifyToken = createTokenVerifier({ jwtSecret: SECRET });

async function auth(sub = 'user-a') {
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setAudience('authenticated')
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
  return { authorization: `Bearer ${jwt}` };
}

const emptyProfile: Profile = { goals: [], allergens: [], restrictions: [], lessSugar: false, lessSodium: false };

function fakeRepos() {
  const products = new Map<string, Product>();
  const profiles = new Map<string, StoredProfile>();
  const history: Array<{ userId: string; barcode: string; scannedAt: Date }> = [];
  const favorites = new Map<string, { userId: string; barcode: string; addedAt: Date }>();
  const repos: Repositories = {
    products: {
      findByBarcode: async (b) => products.get(b) ?? null,
      upsert: async (p) => void products.set(p.barcode, p),
      searchByName: async () => [],
      listByCategory: async (category) =>
        [...products.values()].filter((p) => p.category === category && p.source === 'off'),
    },
    profiles: {
      get: async (u) => profiles.get(u) ?? null,
      upsert: async (u, profile, consentAt) => void profiles.set(u, { profile, consentAt }),
    },
    history: {
      add: async (userId, barcode) => void history.push({ userId, barcode, scannedAt: new Date() }),
      list: async (userId) =>
        history
          .filter((h) => h.userId === userId)
          .map((h) => ({ product: products.get(h.barcode)!, scannedAt: h.scannedAt })),
    },
    favorites: {
      list: async (userId) =>
        [...favorites.values()]
          .filter((f) => f.userId === userId)
          .map((f) => ({ product: products.get(f.barcode)!, addedAt: f.addedAt })),
      add: async (userId, barcode) => {
        if (!favorites.has(`${userId}|${barcode}`)) favorites.set(`${userId}|${barcode}`, { userId, barcode, addedAt: new Date() });
      },
      remove: async (userId, barcode) => void favorites.delete(`${userId}|${barcode}`),
    },
  };
  return { repos, products, profiles, history };
}

function setup(opts: { chat?: ChatModel; vision?: VisionModel; off?: OffLookup } = {}) {
  const fake = fakeRepos();
  const app = buildServer({
    logger: false,
    deps: {
      repos: fake.repos,
      off: vi.fn(opts.off ?? (async () => ({ kind: 'not_found' as const }))),
      verifyToken,
      ...(opts.chat ? { chat: opts.chat } : {}),
      ...(opts.vision ? { vision: opts.vision } : {}),
      now: () => new Date('2026-11-14T12:00:00Z'),
    },
  });
  return { app, ...fake };
}

const base: Product = {
  barcode: '7890000000017',
  name: 'Iogurte Doce',
  category: 'iogurtes',
  isLiquid: false,
  nutrition: { addedSugarsG: 22, sugarsG: 24, saturatedFatG: 5, sodiumMg: 700 },
  ingredientsText: 'leite, açúcar',
  allergensTags: [],
  tracesTags: [],
  additivesTags: [],
  source: 'off',
  verified: true,
};
const yogurtRuim = base;
const yogurtBom: Product = {
  ...base,
  barcode: '7890000000024',
  name: 'Iogurte Natural',
  nutrition: { addedSugarsG: 0, sugarsG: 4, saturatedFatG: 1, sodiumMg: 60, proteinG: 6 },
  ingredientsText: 'leite, fermentos lácteos',
};

describe('GET /v1/compare', () => {
  it('exige de 2 a 3 códigos distintos', async () => {
    const ctx = setup();
    const res = await ctx.app.inject({ url: `/v1/compare?barcodes=${yogurtRuim.barcode}`, headers: await auth() });
    expect(res.statusCode).toBe(400);
  });

  it('compara e recomenda o de menos açúcar quando o perfil pede', async () => {
    const ctx = setup();
    ctx.products.set(yogurtRuim.barcode, yogurtRuim);
    ctx.products.set(yogurtBom.barcode, yogurtBom);
    ctx.profiles.set('user-a', { profile: { ...emptyProfile, lessSugar: true }, consentAt: null });
    const res = await ctx.app.inject({
      url: `/v1/compare?barcodes=${yogurtRuim.barcode},${yogurtBom.barcode}`,
      headers: await auth(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().products).toHaveLength(2);
    expect(res.json().comparison.recommendation.barcode).toBe(yogurtBom.barcode);
  });
});

describe('GET /v1/products/:barcode/alternatives', () => {
  it('mostra alternativas para produto ruim e não mostra para produto bom', async () => {
    const ctx = setup();
    ctx.products.set(yogurtRuim.barcode, yogurtRuim);
    ctx.products.set(yogurtBom.barcode, yogurtBom);

    const ruim = await ctx.app.inject({ url: `/v1/products/${yogurtRuim.barcode}/alternatives`, headers: await auth() });
    expect(ruim.json().shown).toBe(true);
    expect(ruim.json().alternatives[0].analysis.product.barcode).toBe(yogurtBom.barcode);

    const bom = await ctx.app.inject({ url: `/v1/products/${yogurtBom.barcode}/alternatives`, headers: await auth() });
    expect(bom.json().shown).toBe(false);
    expect(bom.json().alternatives).toEqual([]);
  });
});

describe('POST /v1/labels (foto do rótulo)', () => {
  const image = { mimeType: 'image/jpeg' as const, data: 'A'.repeat(200) };
  const goodJson = JSON.stringify({
    name: 'Biscoito de Teste',
    brand: null,
    isLiquid: false,
    per: '100',
    servingSize: null,
    nutrition: { energyKcal: 450, sugarsG: 20, addedSugarsG: null, saturatedFatG: 9, sodiumMg: 500, fiberG: null, proteinG: null },
    ingredientsText: 'farinha, açúcar',
  });

  it('sem leitor de imagem configurado → 503', async () => {
    const ctx = setup();
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/labels', headers: await auth(), payload: { images: [image] } });
    expect(res.statusCode).toBe(503);
  });

  it('lê a foto, grava como dado de usuário e registra no histórico', async () => {
    const vision = vi.fn(async () => goodJson);
    const ctx = setup({ vision });
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/labels', headers: await auth(), payload: { images: [image] } });
    expect(res.statusCode).toBe(200);
    expect(res.json().product.source).toBe('user');
    expect(res.json().product.verified).toBe(false);
    expect(res.json().product.barcode.startsWith('user:')).toBe(true);
    expect(ctx.history).toHaveLength(1);
    expect(vision).toHaveBeenCalledTimes(1);
  });

  it('rótulo ilegível → 422; falha do provedor → 502', async () => {
    const bad = setup({ vision: async () => 'não é json' });
    const r1 = await bad.app.inject({ method: 'POST', url: '/v1/labels', headers: await auth(), payload: { images: [image] } });
    expect(r1.statusCode).toBe(422);
    expect(r1.json()).toEqual({ error: 'label_unreadable' });

    const down = setup({ vision: async () => { throw new Error('boom'); } });
    const r2 = await down.app.inject({ method: 'POST', url: '/v1/labels', headers: await auth(), payload: { images: [image] } });
    expect(r2.statusCode).toBe(502);
  });

  it('nunca sobrescreve um produto que já existe com a foto', async () => {
    const ctx = setup({ vision: async () => goodJson });
    ctx.products.set(yogurtBom.barcode, yogurtBom);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/labels',
      headers: await auth(),
      payload: { images: [image], barcode: yogurtBom.barcode },
    });
    expect(res.json().product.name).toBe('Iogurte Natural');
    expect(res.json().product.source).toBe('off');
  });
});

describe('GET /v1/stats', () => {
  it('resume o histórico do período', async () => {
    const ctx = setup();
    ctx.products.set(yogurtRuim.barcode, yogurtRuim);
    ctx.history.push({ userId: 'user-a', barcode: yogurtRuim.barcode, scannedAt: new Date('2026-11-13T10:00:00Z') });
    const res = await ctx.app.inject({ url: '/v1/stats?days=30', headers: await auth() });
    expect(res.statusCode).toBe(200);
    expect(res.json().totalScans).toBe(1);
    expect(res.json().estimatedSugarG).toBe(22);
    expect(res.json().frequentBad[0].barcode).toBe(yogurtRuim.barcode);
  });

  it('dias fora do intervalo → 400', async () => {
    const ctx = setup();
    const res = await ctx.app.inject({ url: '/v1/stats?days=0', headers: await auth() });
    expect(res.statusCode).toBe(400);
  });
});

describe('listas de compras (favoritos)', () => {
  it('adiciona, lista com sugestão de troca e remove', async () => {
    const ctx = setup();
    ctx.products.set(yogurtRuim.barcode, yogurtRuim);
    ctx.products.set(yogurtBom.barcode, yogurtBom);
    const headers = await auth();

    const put = await ctx.app.inject({ method: 'PUT', url: `/v1/favorites/${yogurtRuim.barcode}`, headers });
    expect(put.statusCode).toBe(204);

    const list = await ctx.app.inject({ url: '/v1/favorites', headers });
    const item = list.json().items[0];
    expect(item.product.barcode).toBe(yogurtRuim.barcode);
    expect(item.suggestion.analysis.product.barcode).toBe(yogurtBom.barcode);

    const del = await ctx.app.inject({ method: 'DELETE', url: `/v1/favorites/${yogurtRuim.barcode}`, headers });
    expect(del.statusCode).toBe(204);
    expect((await ctx.app.inject({ url: '/v1/favorites', headers })).json().items).toEqual([]);
  });

  it('a lista é de cada usuário', async () => {
    const ctx = setup();
    ctx.products.set(yogurtRuim.barcode, yogurtRuim);
    await ctx.app.inject({ method: 'PUT', url: `/v1/favorites/${yogurtRuim.barcode}`, headers: await auth('user-a') });
    const outro = await ctx.app.inject({ url: '/v1/favorites', headers: await auth('user-b') });
    expect(outro.json().items).toEqual([]);
  });
});

describe('POST /v1/ai/explain', () => {
  it('sem modelo configurado → 503', async () => {
    const ctx = setup();
    const res = await ctx.app.inject({ method: 'POST', url: '/v1/ai/explain', headers: await auth(), payload: { module: 'historico' } });
    expect(res.statusCode).toBe(503);
  });

  it('explica o módulo pedido com os dados da tela', async () => {
    const chat = vi.fn<ChatModel>(async () => 'Você escolheu produtos doces.');
    const ctx = setup({ chat });
    ctx.products.set(yogurtRuim.barcode, yogurtRuim);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/ai/explain',
      headers: await auth(),
      payload: { module: 'produto', barcode: yogurtRuim.barcode },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ module: 'produto', reply: 'Você escolheu produtos doces.' });
    expect(chat.mock.calls[0]?.[0].system).toContain('Iogurte Doce');
  });

  it('módulo que precisa de código sem código → 400; comparação com um só código → 400', async () => {
    const ctx = setup({ chat: async () => 'ok' });
    const semCodigo = await ctx.app.inject({ method: 'POST', url: '/v1/ai/explain', headers: await auth(), payload: { module: 'produto' } });
    expect(semCodigo.statusCode).toBe(400);
    const umSo = await ctx.app.inject({
      method: 'POST',
      url: '/v1/ai/explain',
      headers: await auth(),
      payload: { module: 'comparacao', barcodes: [yogurtRuim.barcode] },
    });
    expect(umSo.statusCode).toBe(400);
  });
});
