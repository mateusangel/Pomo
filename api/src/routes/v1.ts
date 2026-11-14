import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analyzeProduct } from '../domain/analysis.js';
import { normalizeBarcode } from '../domain/barcode.js';
import type { Product, Profile } from '../domain/types.js';
import { buildChatSystem } from '../domain/chatPrompt.js';
import type { ChatModel } from '../integrations/gemini.js';
import type { OffLookup } from '../integrations/off.js';
import { requireAuth, type TokenVerifier } from '../plugins/auth.js';
import type { Repositories } from '../repositories/types.js';

export interface Deps {
  repos: Repositories;
  off: OffLookup;
  verifyToken: TokenVerifier;
  /** Apaga o usuário no Supabase Auth (service role); cascata remove perfil e histórico. */
  deleteUser?: (userId: string) => Promise<void>;
  /** Modelo do Pomo.ai; ausente → /v1/chat responde 503. */
  chat?: ChatModel;
  now?: () => Date;
}

const ProfileSchema = z.object({
  goals: z.array(z.string().min(1).max(50)).max(10),
  allergens: z
    .array(
      z.enum(['leite', 'ovo', 'trigo', 'soja', 'amendoim', 'castanhas', 'peixe', 'crustaceos', 'gluten', 'lactose']),
    )
    .max(10),
  restrictions: z.array(z.enum(['vegetariano', 'vegano'])).max(2),
  lessSugar: z.boolean(),
  lessSodium: z.boolean(),
}) satisfies z.ZodType<Profile>;

const PutProfileBody = z.object({ profile: ProfileSchema, consent: z.boolean() });
const ScanBody = z.object({ barcode: z.string().min(1).max(32) });
const ChatBody = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'model']), text: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(20),
  barcode: z.string().min(1).max(32).optional(),
});
const SearchQuery = z.object({ q: z.string().trim().min(2).max(80) });

type Resolved =
  | { kind: 'ok'; product: Product }
  | { kind: 'invalid' }
  | { kind: 'not_found' }
  | { kind: 'upstream' };

export function registerV1Routes(app: FastifyInstance, deps: Deps): void {
  const { repos, off } = deps;
  const now = deps.now ?? (() => new Date());

  async function resolveProduct(raw: string): Promise<Resolved> {
    const barcode = normalizeBarcode(raw);
    if (!barcode) return { kind: 'invalid' };

    const stored = await repos.products.findByBarcode(barcode);
    if (stored) return { kind: 'ok', product: stored };

    const result = await off(barcode);
    if (result.kind === 'error') return { kind: 'upstream' };
    if (result.kind === 'not_found') return { kind: 'not_found' };

    await repos.products.upsert(result.product);
    return { kind: 'ok', product: result.product };
  }

  const failures = {
    invalid: { status: 400, body: { error: 'invalid_barcode' } },
    not_found: { status: 404, body: { error: 'not_found' } },
    upstream: { status: 502, body: { error: 'upstream_unavailable' } },
  } as const;

  app.register(async (v1) => {
    v1.addHook('preHandler', requireAuth(deps.verifyToken));

    v1.post('/scans', async (request, reply) => {
      const body = ScanBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

      const resolved = await resolveProduct(body.data.barcode);
      if (resolved.kind !== 'ok') {
        const f = failures[resolved.kind];
        return reply.code(f.status).send(f.body);
      }
      await repos.history.add(request.userId, resolved.product.barcode);
      const stored = await repos.profiles.get(request.userId);
      return analyzeProduct(resolved.product, stored?.profile ?? null);
    });

    v1.get('/products/search', async (request, reply) => {
      const query = SearchQuery.safeParse(request.query);
      if (!query.success) return reply.code(400).send({ error: 'invalid_request' });
      const products = await repos.products.searchByName(query.data.q, 20);
      const stored = await repos.profiles.get(request.userId);
      return {
        products,
        results: products.map((p) => analyzeProduct(p, stored?.profile ?? null)),
      };
    });

    v1.get('/products/:barcode', async (request, reply) => {
      const { barcode } = request.params as { barcode: string };
      const resolved = await resolveProduct(barcode);
      if (resolved.kind !== 'ok') {
        const f = failures[resolved.kind];
        return reply.code(f.status).send(f.body);
      }
      const stored = await repos.profiles.get(request.userId);
      return analyzeProduct(resolved.product, stored?.profile ?? null);
    });

    v1.get('/profile', async (request) => {
      const stored = await repos.profiles.get(request.userId);
      return {
        profile: stored?.profile ?? null,
        consentAt: stored?.consentAt?.toISOString() ?? null,
      };
    });

    v1.put('/profile', async (request, reply) => {
      const body = PutProfileBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
      const { profile, consent } = body.data;

      const existing = await repos.profiles.get(request.userId);
      const consentAt = existing?.consentAt ?? (consent ? now() : null);
      const hasHealthData =
        profile.goals.length > 0 || profile.allergens.length > 0 || profile.restrictions.length > 0;

      if (hasHealthData && !consentAt) {
        return reply.code(422).send({ error: 'consent_required' });
      }
      await repos.profiles.upsert(request.userId, profile, consentAt);
      return { profile, consentAt: consentAt?.toISOString() ?? null };
    });

    v1.get('/history', async (request) => {
      const items = await repos.history.list(request.userId, 100);
      const stored = await repos.profiles.get(request.userId);
      return {
        items: items.map((i) => ({
          product: i.product,
          analysis: analyzeProduct(i.product, stored?.profile ?? null),
          scannedAt: i.scannedAt.toISOString(),
        })),
      };
    });

    v1.post('/chat', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
      if (!deps.chat) return reply.code(503).send({ error: 'chat_unavailable' });
      const body = ChatBody.safeParse(request.body);
      if (!body.success || body.data.messages[body.data.messages.length - 1]!.role !== 'user') {
        return reply.code(400).send({ error: 'invalid_request' });
      }
      const stored = await repos.profiles.get(request.userId);
      let analysis = null;
      if (body.data.barcode) {
        const resolved = await resolveProduct(body.data.barcode);
        if (resolved.kind === 'ok') analysis = analyzeProduct(resolved.product, stored?.profile ?? null);
      }
      try {
        const text = await deps.chat({
          system: buildChatSystem(stored?.profile ?? null, analysis),
          turns: body.data.messages,
        });
        return { reply: text };
      } catch (err) {
        request.log.error({ err: err instanceof Error ? err.message : 'desconhecido' }, 'falha no chat');
        return reply.code(502).send({ error: 'upstream_unavailable' });
      }
    });

    v1.delete('/account', async (request, reply) => {
      if (!deps.deleteUser) return reply.code(503).send({ error: 'account_deletion_unavailable' });
      await deps.deleteUser(request.userId);
      return reply.code(204).send();
    });
  }, { prefix: '/v1' });
}
