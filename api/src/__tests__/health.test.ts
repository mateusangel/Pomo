import { describe, expect, it } from 'vitest';
import { buildServer } from '../server.js';

describe('GET /health', () => {
  it('responde 200 { ok: true }', async () => {
    const app = buildServer();
    const res = await app.inject({ url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    await app.close();
  });
});

describe('GET /ping', () => {
  it('responde 200 sem depender de banco ou autenticação', async () => {
    const app = buildServer();
    const res = await app.inject({ url: '/ping' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, pong: true });
    await app.close();
  });
});
