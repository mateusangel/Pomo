import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analyzeProduct } from '../domain/analysis.js';
import { rankAlternatives, BAD_SCORE_THRESHOLD, type Alternative } from '../domain/alternatives.js';
import { compareProducts, type Comparison } from '../domain/compare.js';
import { normalizeBarcode } from '../domain/barcode.js';
import { buildChatSystem } from '../domain/chatPrompt.js';
import { buildExplainPrompt, EXPLAIN_MODULES, type ExplainModule } from '../domain/explainPrompt.js';
import { hasAiAccess, type Plan } from '../domain/entitlements.js';
import {
  LABEL_PROMPT,
  LabelUnreadableError,
  labelToProduct,
  parseLabelExtraction,
} from '../domain/labelReading.js';
import { summarizeHistory, type StatsSummary } from '../domain/stats.js';
import type { Product, ProductAnalysis, Profile } from '../domain/types.js';
import type { ChatModel, VisionModel } from '../integrations/gemini.js';
import type { OffLookup } from '../integrations/off.js';
import { requireAuth, type TokenVerifier } from '../plugins/auth.js';
import type { Repositories } from '../repositories/types.js';

export interface Deps {
  repos: Repositories;
  off: OffLookup;
  verifyToken: TokenVerifier;
  /** Apaga o usuário no Supabase Auth (service role); cascata remove perfil e histórico. */
  deleteUser?: (userId: string) => Promise<void>;
  /** Modelo do Pomo.ai (chat e explicações); ausente → 503. */
  chat?: ChatModel;
  /** Leitura de fotos de rótulo; ausente → /v1/labels responde 503. */
  vision?: VisionModel;
  /** Plano do usuário para liberar recursos de IA. Padrão: entitlements.ts. */
  planOf?: (userId: string) => Promise<Plan>;
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
const CompareQuery = z.object({ barcodes: z.string().min(3).max(200) });
const StatsQuery = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });
const LabelBody = z.object({
  images: z
    .array(
      z.object({
        mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
        data: z.string().min(100).max(6_000_000),
      }),
    )
    .min(1)
    .max(2),
  barcode: z.string().min(1).max(32).optional(),
});
const ExplainBody = z.object({
  module: z.enum(EXPLAIN_MODULES),
  barcode: z.string().min(1).max(32).optional(),
  barcodes: z.array(z.string().min(1).max(32)).min(2).max(3).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

type Resolved =
  | { kind: 'ok'; product: Product }
  | { kind: 'invalid' }
  | { kind: 'not_found' }
  | { kind: 'upstream' };

const failures = {
  invalid: { status: 400, body: { error: 'invalid_barcode' } },
  not_found: { status: 404, body: { error: 'not_found' } },
  upstream: { status: 502, body: { error: 'upstream_unavailable' } },
} as const;

/** Lista de 2 ou 3 códigos separados por vírgula, sem repetição. */
function parseBarcodeList(raw: string): string[] | null {
  const items = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
  return items.length >= 2 && items.length <= 3 ? items : null;
}

export function registerV1Routes(app: FastifyInstance, deps: Deps): void {
  const { repos, off } = deps;
  const now = deps.now ?? (() => new Date());
  const planOf = deps.planOf ?? (async () => 'gratis' as Plan);

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

  /** Produtos da mesma categoria já conhecidos pelo Pomo, analisados para este perfil. */
  async function candidatesFor(category: string | undefined, profile: Profile | null): Promise<ProductAnalysis[]> {
    if (!category) return [];
    const products = await repos.products.listByCategory(category, 200);
    return products.map((p) => analyzeProduct(p, profile));
  }

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

    // Alternativas só para produtos ruins; `shown` diz ao app se deve exibir a seção.
    v1.get('/products/:barcode/alternatives', async (request, reply) => {
      const { barcode } = request.params as { barcode: string };
      const resolved = await resolveProduct(barcode);
      if (resolved.kind !== 'ok') {
        const f = failures[resolved.kind];
        return reply.code(f.status).send(f.body);
      }
      const stored = await repos.profiles.get(request.userId);
      const profile = stored?.profile ?? null;
      const current = analyzeProduct(resolved.product, profile);
      const shown = current.score.status === 'ok' && current.score.score < BAD_SCORE_THRESHOLD;
      const alternatives: Alternative[] = shown
        ? rankAlternatives(current, await candidatesFor(current.product.category, profile), profile)
        : [];
      return { current, shown, alternatives };
    });

    v1.get('/compare', async (request, reply) => {
      const query = CompareQuery.safeParse(request.query);
      const barcodes = query.success ? parseBarcodeList(query.data.barcodes) : null;
      if (!barcodes) return reply.code(400).send({ error: 'invalid_request' });

      const stored = await repos.profiles.get(request.userId);
      const profile = stored?.profile ?? null;
      const analyses: ProductAnalysis[] = [];
      for (const raw of barcodes) {
        const resolved = await resolveProduct(raw);
        if (resolved.kind !== 'ok') {
          const f = failures[resolved.kind];
          return reply.code(f.status).send(f.body);
        }
        analyses.push(analyzeProduct(resolved.product, profile));
      }
      return { products: analyses, comparison: compareProducts(analyses, profile) };
    });

    v1.post('/labels', { bodyLimit: 8 * 1024 * 1024, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
      if (!deps.vision) return reply.code(503).send({ error: 'label_reading_unavailable' });
      const body = LabelBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_request' });

      let barcode: string | null = null;
      if (body.data.barcode) {
        barcode = normalizeBarcode(body.data.barcode);
        if (!barcode) return reply.code(400).send({ error: 'invalid_barcode' });
      }

      let raw: string;
      try {
        raw = await deps.vision({ system: LABEL_PROMPT, prompt: 'Leia este rótulo e devolva o JSON.', images: body.data.images });
      } catch (err) {
        request.log.error({ err: err instanceof Error ? err.message : 'desconhecido' }, 'falha na leitura do rótulo');
        return reply.code(502).send({ error: 'upstream_unavailable' });
      }

      let product: Product;
      try {
        const extraction = parseLabelExtraction(raw);
        product = labelToProduct(extraction, barcode ?? `user:${randomUUID()}`);
      } catch (err) {
        if (err instanceof LabelUnreadableError) return reply.code(422).send({ error: 'label_unreadable' });
        throw err;
      }

      // Nunca sobrescreve um produto que já existe (dado do OFF ou verificado) com foto de usuário.
      const existing = barcode ? await repos.products.findByBarcode(barcode) : null;
      if (existing) {
        product = existing;
      } else {
        await repos.products.upsert(product);
      }
      await repos.history.add(request.userId, product.barcode);
      const stored = await repos.profiles.get(request.userId);
      return analyzeProduct(product, stored?.profile ?? null);
    });

    v1.get('/stats', async (request, reply) => {
      const query = StatsQuery.safeParse(request.query);
      if (!query.success) return reply.code(400).send({ error: 'invalid_request' });
      const items = await repos.history.list(request.userId, 1000);
      const stored = await repos.profiles.get(request.userId);
      const profile = stored?.profile ?? null;
      const summary: StatsSummary = summarizeHistory(
        items.map((i) => ({ analysis: analyzeProduct(i.product, profile), scannedAt: i.scannedAt })),
        now(),
        query.data.days,
      );
      return summary;
    });

    v1.get('/favorites', async (request) => {
      const items = await repos.favorites.list(request.userId);
      const stored = await repos.profiles.get(request.userId);
      const profile = stored?.profile ?? null;

      // Sugestão de troca: melhor alternativa da mesma categoria, para cada item ruim.
      const candidateCache = new Map<string, ProductAnalysis[]>();
      const withSuggestions = [];
      for (const item of items) {
        const analysis = analyzeProduct(item.product, profile);
        let suggestion: Alternative | null = null;
        if (analysis.score.status === 'ok' && analysis.score.score < BAD_SCORE_THRESHOLD && item.product.category) {
          const key = item.product.category;
          if (!candidateCache.has(key)) candidateCache.set(key, await candidatesFor(key, profile));
          suggestion = rankAlternatives(analysis, candidateCache.get(key)!, profile, 1)[0] ?? null;
        }
        withSuggestions.push({ product: item.product, analysis, addedAt: item.addedAt.toISOString(), suggestion });
      }
      return { items: withSuggestions };
    });

    v1.put('/favorites/:barcode', async (request, reply) => {
      const { barcode } = request.params as { barcode: string };
      const resolved = await resolveProduct(barcode);
      if (resolved.kind !== 'ok') {
        const f = failures[resolved.kind];
        return reply.code(f.status).send(f.body);
      }
      await repos.favorites.add(request.userId, resolved.product.barcode);
      return reply.code(204).send();
    });

    v1.delete('/favorites/:barcode', async (request, reply) => {
      const { barcode } = request.params as { barcode: string };
      const normalized = normalizeBarcode(barcode);
      if (!normalized) return reply.code(400).send({ error: 'invalid_barcode' });
      await repos.favorites.remove(request.userId, normalized);
      return reply.code(204).send();
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

    // Pomo.ai explicando a tela atual. O acesso depende do plano (hoje liberado para todos).
    v1.post('/ai/explain', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
      if (!deps.chat) return reply.code(503).send({ error: 'chat_unavailable' });
      const body = ExplainBody.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
      if (!hasAiAccess(await planOf(request.userId))) return reply.code(402).send({ error: 'plan_required' });

      const module: ExplainModule = body.data.module;
      const stored = await repos.profiles.get(request.userId);
      const profile = stored?.profile ?? null;
      const context = await buildExplainContext(request.userId, module, body.data, profile);
      if (!context) return reply.code(400).send({ error: 'invalid_request' });

      const { system, prompt } = buildExplainPrompt(context);
      try {
        const text = await deps.chat({ system, turns: [{ role: 'user', text: prompt }] });
        return { module, reply: text };
      } catch (err) {
        request.log.error({ err: err instanceof Error ? err.message : 'desconhecido' }, 'falha na explicação');
        return reply.code(502).send({ error: 'upstream_unavailable' });
      }
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

    /** Reúne só os dados que a tela pedida mostra. null = pedido inválido para o módulo. */
    async function buildExplainContext(
      userId: string,
      module: ExplainModule,
      input: z.infer<typeof ExplainBody>,
      profile: Profile | null,
    ) {
      const single = async (raw: string) => {
        const resolved = await resolveProduct(raw);
        return resolved.kind === 'ok' ? analyzeProduct(resolved.product, profile) : null;
      };

      switch (module) {
        case 'produto': {
          const product = input.barcode ? await single(input.barcode) : null;
          return product ? { module, profile, product } : null;
        }
        case 'alternativas': {
          const product = input.barcode ? await single(input.barcode) : null;
          if (!product) return null;
          const products = (await candidatesFor(product.product.category, profile)).slice(0, 5);
          return { module, profile, product, products };
        }
        case 'comparacao': {
          if (!input.barcodes) return null;
          const analyses: ProductAnalysis[] = [];
          for (const raw of input.barcodes) {
            const a = await single(raw);
            if (!a) return null;
            analyses.push(a);
          }
          const comparison: Comparison = compareProducts(analyses, profile);
          return { module, profile, products: analyses, comparison };
        }
        case 'evolucao': {
          const items = await repos.history.list(userId, 1000);
          const stats = summarizeHistory(
            items.map((i) => ({ analysis: analyzeProduct(i.product, profile), scannedAt: i.scannedAt })),
            now(),
            input.days ?? 30,
          );
          return { module, profile, stats };
        }
        case 'historico': {
          const items = await repos.history.list(userId, 20);
          return { module, profile, products: items.map((i) => analyzeProduct(i.product, profile)) };
        }
        case 'listas': {
          const items = await repos.favorites.list(userId);
          return { module, profile, products: items.map((i) => analyzeProduct(i.product, profile)) };
        }
      }
    }
  }, { prefix: '/v1' });
}
