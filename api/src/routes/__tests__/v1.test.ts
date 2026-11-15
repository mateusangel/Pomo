import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Profile } from '../../domain/types.js';
import type { OffLookup } from '../../integrations/off.js';
import { createTokenVerifier } from '../../plugins/auth.js';
import type { Repositories, StoredProfile } from '../../repositories/types.js';
import { buildServer } from '../../server.js';

const SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';
const verifyToken = createTokenVerifier({ jwtSecret: SECRET });

async function token(sub: string, opts: { aud?: string; secret?: string; exp?: string } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setAudience(opts.aud ?? 'authenticated')
    .setExpirationTime(opts.exp ?? '1h')
    .sign(new TextEncoder().encode(opts.secret ?? SECRET));
}

const milk: Product = {
  barcode: '7891000100103',
  name: 'Leite Integral',
  isLiquid: true,
  nutrition: { addedSugarsG: 0, saturatedFatG: 1.2, sodiumMg: 45 },
  ingredientsText: 'leite integral',
  allergensTags: ['en:milk'],
  tracesTags: [],
  additivesTags: [],
  source: 'off',
  verified: true,
};

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
      searchByName: async (q) => [...products.values()].filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
      listByCategory: async (category) =>
        [...products.values()].filter((p) => p.category === category && p.source === 'off'),
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
  };
  return { repos, products, profiles, history };
}

function setup(offImpl: OffLookup = async () => ({ kind: 'found', product: milk })) {
  const fake = fakeRepos();
  const off = vi.fn(offImpl);
  const deleteUser = vi.fn(async (_id: string) => {});
  const app = buildServer({
    logger: false,
    deps: { repos: fake.repos, off, verifyToken, deleteUser, now: () => new Date('2026-11-14T12:00:00Z') },
  });
  return { app, off, deleteUser, ...fake };
}

const auth = async (sub = 'user-a') => ({ authorization: `Bearer ${await token(sub)}` });

describe('autenticação', () => {
  it('rejeita ausente, expirado, assinatura errada e aud errado', async () => {
    const { app } = setup();
    const bad = [
      undefined,
      `Bearer ${await token('u', { exp: '-1h' })}`,
      `Bearer ${await token('u', { secret: 'outro-segredo-com-mais-de-32-caracteres!!' })}`,
      `Bearer ${await token('u', { aud: 'anon' })}`,
      'Bearer lixo',
    ];
    for (const authorization of bad) {
      const res = await app.inject({ url: '/v1/history', headers: authorization ? { authorization } : {} });
      expect(res.statusCode).toBe(401);
    }
  });
});

describe('POST /v1/scans', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => void (ctx = setup()));

  const scan = async (barcode: string, sub = 'user-a') =>
    ctx.app.inject({ method: 'POST', url: '/v1/scans', headers: await auth(sub), payload: { barcode } });

  it('código inválido → 400 sem chamar o OFF', async () => {
    const res = await scan('123');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: 'invalid_barcode' });
    expect(ctx.off).not.toHaveBeenCalled();
  });

  it('miss no banco + OFF ok → grava produto, histórico e devolve análise', async () => {
    const res = await scan('7891000100103');
    expect(res.statusCode).toBe(200);
    expect(res.json().product.name).toBe('Leite Integral');
    expect(res.json().scoreVersion).toBe('1');
    expect(ctx.products.has('7891000100103')).toBe(true);
    expect(ctx.history).toHaveLength(1);
  });

  it('hit no banco não chama o OFF', async () => {
    ctx.products.set(milk.barcode, milk);
    await scan('7891000100103');
    expect(ctx.off).not.toHaveBeenCalled();
  });

  it('UPC-A e EAN-13 com zero resolvem o mesmo produto', async () => {
    const upc = '036000291452';
    ctx = setup(async (b) => ({ kind: 'found', product: { ...milk, barcode: b } }));
    await scan(upc);
    await scan('0036000291452');
    expect(ctx.off).toHaveBeenCalledTimes(1);
    expect(ctx.off).toHaveBeenCalledWith('0036000291452');
  });

  it('OFF 404 → 404; OFF com erro → 502', async () => {
    ctx = setup(async () => ({ kind: 'not_found' }));
    expect((await scan('7891000100103')).statusCode).toBe(404);
    ctx = setup(async () => ({ kind: 'error' }));
    const res = await scan('7891000100103');
    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({ error: 'upstream_unavailable' });
  });

  it('perfil altera os alertas, nunca a nota', async () => {
    const before = (await scan('7891000100103')).json();
    ctx.profiles.set('user-a', {
      profile: { ...emptyProfile, allergens: ['leite'] },
      consentAt: new Date(),
    });
    const after = (await scan('7891000100103')).json();
    expect(before.alerts.alerts).toEqual([]);
    expect(after.alerts.alerts).toHaveLength(1);
    expect(after.score).toEqual(before.score);
  });

  it('GET /products/:barcode não grava histórico', async () => {
    const res = await ctx.app.inject({ url: '/v1/products/7891000100103', headers: await auth() });
    expect(res.statusCode).toBe(200);
    expect(ctx.history).toHaveLength(0);
  });
});

describe('GET /v1/products/search', () => {
  it('exige ao menos 2 caracteres', async () => {
    const { app } = setup();
    const res = await app.inject({ url: '/v1/products/search?q=a', headers: await auth() });
    expect(res.statusCode).toBe(400);
  });
  it('encontra pelo nome', async () => {
    const ctx = setup();
    ctx.products.set(milk.barcode, milk);
    const res = await ctx.app.inject({ url: '/v1/products/search?q=leite', headers: await auth() });
    expect(res.json().products).toHaveLength(1);
    expect(res.json().results[0].product.name).toBe('Leite Integral');
    expect(res.json().results[0].score.status).toBeDefined();
  });
});

describe('perfil e LGPD', () => {
  const put = (ctx: ReturnType<typeof setup>, profile: Profile, consent: boolean, sub = 'user-a') =>
    auth(sub).then((headers) => ctx.app.inject({ method: 'PUT', url: '/v1/profile', headers, payload: { profile, consent } }));

  it('alergia sem consentimento → 422 e nada gravado', async () => {
    const ctx = setup();
    const res = await put(ctx, { ...emptyProfile, allergens: ['leite'] }, false);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ error: 'consent_required' });
    expect(ctx.profiles.size).toBe(0);
  });

  it('com consentimento grava consentAt', async () => {
    const ctx = setup();
    const res = await put(ctx, { ...emptyProfile, allergens: ['leite'] }, true);
    expect(res.statusCode).toBe(200);
    expect(res.json().consentAt).toBe('2026-11-14T12:00:00.000Z');
  });

  it('perfil vazio sem consentimento é permitido', async () => {
    const ctx = setup();
    expect((await put(ctx, emptyProfile, false)).statusCode).toBe(200);
  });

  it('consentimento anterior vale para atualizações futuras', async () => {
    const ctx = setup();
    await put(ctx, { ...emptyProfile, allergens: ['leite'] }, true);
    const res = await put(ctx, { ...emptyProfile, allergens: ['leite', 'ovo'] }, false);
    expect(res.statusCode).toBe(200);
  });

  it('valores inválidos → 400', async () => {
    const ctx = setup();
    const res = await put(ctx, { ...emptyProfile, allergens: ['pizza' as never] }, true);
    expect(res.statusCode).toBe(400);
  });

  it('usuário B não vê perfil nem histórico do A', async () => {
    const ctx = setup();
    await put(ctx, { ...emptyProfile, allergens: ['leite'] }, true, 'user-a');
    await ctx.app.inject({ method: 'POST', url: '/v1/scans', headers: await auth('user-a'), payload: { barcode: '7891000100103' } });

    const profileB = await ctx.app.inject({ url: '/v1/profile', headers: await auth('user-b') });
    expect(profileB.json()).toEqual({ profile: null, consentAt: null });
    const historyB = await ctx.app.inject({ url: '/v1/history', headers: await auth('user-b') });
    expect(historyB.json()).toEqual({ items: [] });
    const historyA = await ctx.app.inject({ url: '/v1/history', headers: await auth('user-a') });
    expect(historyA.json().items).toHaveLength(1);
  });
});

describe('DELETE /v1/account', () => {
  it('apaga só o usuário do JWT', async () => {
    const ctx = setup();
    const res = await ctx.app.inject({ method: 'DELETE', url: '/v1/account?userId=outro', headers: await auth('user-a'), payload: undefined });
    expect(res.statusCode).toBe(204);
    expect(ctx.deleteUser).toHaveBeenCalledExactlyOnceWith('user-a');
  });
  it('sem token → 401 e nada apagado', async () => {
    const ctx = setup();
    const res = await ctx.app.inject({ method: 'DELETE', url: '/v1/account' });
    expect(res.statusCode).toBe(401);
    expect(ctx.deleteUser).not.toHaveBeenCalled();
  });
});

describe('POST /v1/chat (Pomo.ai)', () => {
  function chatSetup(chat?: (i: { system: string; turns: unknown[] }) => Promise<string>) {
    const fake = fakeRepos();
    const off = vi.fn<OffLookup>(async () => ({ kind: 'found', product: milk }));
    const app = buildServer({ logger: false, deps: { repos: fake.repos, off, verifyToken, ...(chat ? { chat } : {}) } });
    return { app, ...fake };
  }
  const msg = { messages: [{ role: 'user', text: 'Esse leite é bom?' }] };

  it('exige login', async () => {
    const { app } = chatSetup(async () => 'oi');
    expect((await app.inject({ method: 'POST', url: '/v1/chat', payload: msg })).statusCode).toBe(401);
  });

  it('503 sem modelo configurado', async () => {
    const { app } = chatSetup();
    const res = await app.inject({ method: 'POST', url: '/v1/chat', headers: await auth(), payload: msg });
    expect(res.statusCode).toBe(503);
  });

  it('responde e injeta perfil e produto no prompt de sistema', async () => {
    const chat = vi.fn(async (_i: { system: string; turns: unknown[] }) => 'Boa escolha!');
    const { app, profiles } = chatSetup(chat);
    profiles.set('user-a', { profile: { ...emptyProfile, allergens: ['amendoim'] }, consentAt: new Date() });
    const res = await app.inject({
      method: 'POST', url: '/v1/chat', headers: await auth(),
      payload: { ...msg, barcode: '7891000100103' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ reply: 'Boa escolha!' });
    const system = chat.mock.calls[0]![0].system;
    expect(system).toContain('amendoim');
    expect(system).toContain('Leite Integral');
  });

  it('400 se a última mensagem não for do usuário; 502 se o provedor falhar', async () => {
    const { app } = chatSetup(async () => { throw new Error('boom'); });
    const bad = await app.inject({
      method: 'POST', url: '/v1/chat', headers: await auth(),
      payload: { messages: [{ role: 'model', text: 'oi' }] },
    });
    expect(bad.statusCode).toBe(400);
    const down = await app.inject({ method: 'POST', url: '/v1/chat', headers: await auth(), payload: msg });
    expect(down.statusCode).toBe(502);
  });
});
