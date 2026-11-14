# Pomo AI — Plano 1: Fundação do MVP (rev. 2 — backend Fastify + Prisma)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revisão 2 (2026-11-14):** o fundador decidiu usar **Node.js + Fastify + Prisma + Supabase PostgreSQL**. O Fastify concentra regras de negócio e API; as Edge Functions deixam de existir; a fórmula da nota (e aditivos/alérgenos/barcode) vive **só no backend**. O que já existia (scaffold do `app/`, `supabase/config.toml`, teste smoke) é preservado.

**Goal:** Entregar o núcleo grátis do Pomo: conta anônima, perfil com consentimento LGPD, scan/busca de produto, nota base determinística, alertas de alergia por regras, aditivos e histórico.

**Architecture:** Três peças com responsabilidades separadas.
- **App Expo (TypeScript)**: só interface. Autentica no Supabase Auth (anônimo) e chama a API Fastify com o JWT. **Não calcula nota, alerta nem aditivo**; só exibe o que a API devolve.
- **API Fastify (`api/`)**: valida o JWT do Supabase, aplica todas as regras de negócio (domínio puro: barcode, nota, aditivos, alérgenos), consulta o Open Food Facts (OFF) e acessa o Postgres via Prisma.
- **Supabase**: Auth (contas anônimas, depois Google/e-mail) e PostgreSQL. O app **não acessa tabelas diretamente**.

**Tech Stack:** Expo (React Native, TypeScript, expo-router, expo-camera), Jest (jest-expo) no app; Node 22+, Fastify 5, Zod (validação e contratos), Prisma, Vitest, `jose` (JWT) na API; Supabase (Auth + Postgres).

**Spec:** `docs/superpowers/specs/2026-11-14-pomo-ai-design.md` (as seções de arquitetura que citam Edge Functions ficam superadas por este plano; atualizar o spec na Task 1).

**Fora deste plano (planos seguintes):** Pomo+ (leitura personalizada, alternativas, chat, comparação, RevenueCat), foto de rótulo com Gemini (também no Fastify), mascote animado, design system e telas finais, importação em massa do OFF, fila de revisão, envio de contribuições ao OFF. As telas deste plano são funcionais e sem identidade visual; o plano seguinte (design) as reveste.

## Decisões de arquitetura (rev. 2)

| Tema | Decisão | Motivo |
|---|---|---|
| Fonte única da nota | `computeBaseScore`, aditivos, alérgenos e barcode só em `api/src/domain/`; a resposta traz `scoreVersion` | Evita divergência Android/iOS/futuro web; resolve o "ponto aberto" da rev. 1 (alternativas e importação em massa usarão a mesma função) |
| Auth | Supabase Auth continua (anônimo → Google/e-mail). A API verifica o JWT (`jose`, JWKS do projeto; fallback HS256 via `SUPABASE_JWT_SECRET`) e usa `sub` como `user_id` | Mantém conversão anônimo→conta sem perder dados e o mesmo ID no RevenueCat |
| Acesso a dados | Só a API acessa o banco (Prisma, conexão privilegiada). Toda query de dado de usuário filtra por `user_id` do JWT | Prisma ignora RLS; a autorização vive no código, testada |
| RLS | Mantido **ligado em todas as tabelas, sem políticas para `anon`/`authenticated`** (deny-all) + `REVOKE` nos roles do PostgREST | Defesa em profundidade: se a chave anônima vazar, as tabelas continuam fechadas |
| Schema | Prisma Migrate é a fonte do schema; SQL manual dentro das migrations para o que o Prisma não modela (CHECK de consentimento, `pg_trgm`, FK para `auth.users`, RLS, função de busca) | Um único histórico de migrations |
| Conexão | `DATABASE_URL` = pooler Supavisor (modo transação, `pgbouncer=true`); `DIRECT_URL` = conexão direta só para migrate | Padrão Prisma + Supabase |
| Contrato | Rotas com Zod (`fastify-type-provider-zod`) + OpenAPI (`@fastify/swagger`); o app gera tipos com `openapi-typescript` em `app/src/api/schema.ts` | Tipos do app derivados da API, sem pacote compartilhado (evita atrito de monorepo no Metro) |
| Testes | Vitest: domínio puro; rotas com `app.inject()` e repositórios falsos (interfaces); testes de banco com `DATABASE_URL` de teste, ignorados se ausente | Esta máquina não tem Docker; pgTAP e Supabase local deixam de ser necessários |
| Hospedagem | Dockerfile + deploy em Railway, Render ou Fly.io (decidir na Task 10, sem bloquear o dev) | A API é um serviço novo a operar; o dev local usa `npm run dev` |

### Edge Functions: o que muda

| Edge Function (rev. 1) | Destino | Nota |
|---|---|---|
| `lookup-product` | **Substituída** por `POST /v1/scans` e `GET /v1/products/:barcode` | Cliente OFF, mapper, barcode e gravação com Prisma |
| `search-products` | **Substituída** por `GET /v1/products/search?q=` | Usa a função `search_products_by_name` (trigrama) |
| `delete-account` | **Substituída** por `DELETE /v1/account` | Fastify chama a Admin API do Supabase (service role) para apagar o usuário; cascata apaga perfil e histórico |
| `_shared/off-mapper.ts`, `_shared/barcode.ts` | **Movidos** para `api/src/` (Node, sem cópia em Deno) | Elimina a duplicação Deno/TS da rev. 1; `npx deno` deixa de ser necessário |

Nenhuma Edge Function permanece. O diretório `supabase/` guarda só a configuração de Auth.

### Superfície da API (v1, todas exigem `Authorization: Bearer <jwt>` exceto `/health`)

| Método e rota | Função |
|---|---|
| `GET /health` | Liveness |
| `POST /v1/scans` `{ barcode }` | Normaliza, busca (banco → OFF), grava histórico, devolve `ProductAnalysis` |
| `GET /v1/products/:barcode` | Mesma análise, sem gravar histórico |
| `GET /v1/products/search?q=` | Busca por nome (mín. 2 caracteres) |
| `GET /v1/profile`, `PUT /v1/profile` `{ profile, consent }` | Perfil e consentimento LGPD (erro `consent_required` 422) |
| `GET /v1/history` | Histórico do usuário |
| `DELETE /v1/account` | Exclusão de conta e dados |

`ProductAnalysis = { product, score: ScoreResult, scoreVersion: string, additives: AdditiveInfo[], alerts: AlertReport }`. Os alertas são calculados no servidor com o perfil do usuário autenticado; a **nota nunca usa o perfil**.

## Global Constraints

- Idioma de toda a interface, textos e mensagens da API voltadas ao usuário: português do Brasil. Códigos de erro da API em inglês (`not_found`, `invalid_barcode`…).
- Plataforma: Android primeiro; nada que bloqueie iOS (só APIs do Expo SDK). A API é independente de plataforma.
- Nota base: 0–100, determinística, sem IA; faixas "excelente", "bom", "regular", "ruim". Calculada **apenas** na API.
- Limites da lupa ANVISA (RDC 429/2020, IN 75/2020), por 100 g (sólidos) / 100 ml (líquidos): açúcar adicionado ≥ 15 g / 7,5 g; gordura saturada ≥ 6 g / 3 g; sódio ≥ 600 mg / 300 mg.
- Alerta de alergia nunca depende de IA; dados incompletos nunca viram "seguro".
- Dados de saúde só são gravados após consentimento LGPD explícito (validação na API **e** CHECK no banco); a pessoa pode excluir conta e dados.
- Cada explicação de aditivo cita a fonte (EFSA/JECFA/ANVISA).
- Aviso "o app informa e orienta, não substitui um profissional" visível no onboarding e na tela do produto.
- Produto de origem `user` e não verificado mostra "dados enviados por usuário, confira o rótulo" junto aos alertas.
- Segredos (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_JWT_SECRET`) só em `api/.env` (fora do git) e no provedor de hospedagem. O app contém apenas `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` e `EXPO_PUBLIC_API_URL`.
- A API aplica rate limit (`@fastify/rate-limit`) e CORS restrito; nunca registra JWT, perfil de saúde nem alergias em log.

## Review Focus

- Código de barras: EAN-8, EAN-13 e UPC-A (12 dígitos) chegam normalizados; zeros à esquerda não criam produtos duplicados; leitura inválida é rejeitada (400).
- Produto sem campos nutricionais suficientes: resultado "dados insuficientes", nunca nota 0 nem 100.
- Alérgenos: maiúsculas/minúsculas e acentos ("LEITE", "Amêndoa"), "pode conter" (traços) e ausência total de dados (→ "dados incompletos", não "seguro").
- OFF fora do ar, lento ou 404: a API devolve `404 not_found` / `502 upstream_unavailable` tratáveis, sem travar; sódio em gramas e sal separadamente (conversão para mg).
- Mesmo produto pontuado duas vezes dá resultado idêntico; líquido e sólido usam limites diferentes.
- **Isolamento entre usuários:** nenhuma rota devolve ou altera dados de outro `user_id`; JWT ausente, expirado ou com assinatura errada → 401.
- Prisma: nenhuma query de dado de usuário sem filtro de `user_id`; migrations aplicam CHECK, RLS e FK para `auth.users`.

## File Structure

```
app/                              # Expo (existente, preservado)
  app/                            # rotas expo-router (onboarding, scan, product/[barcode], history, search, settings)
  src/api/schema.ts               # tipos gerados do OpenAPI da API
  src/api/client.ts               # fetch tipado com JWT; mapeia erros
  src/data/supabase.ts            # client Supabase só para Auth (sessão anônima)
  src/data/products.ts            # scan/getProduct/searchProducts (chama a API)
  src/data/profile.ts             # load/save profile + consent, deleteAccount (chama a API)
  src/data/history.ts             # listHistory (chama a API)
api/                              # NOVO — Node + Fastify + Prisma
  package.json  tsconfig.json  vitest.config.ts  Dockerfile  .env.example
  prisma/schema.prisma
  prisma/migrations/0001_core/migration.sql   # tabelas + SQL manual (CHECK, pg_trgm, RLS, FK auth.users, função de busca)
  src/server.ts                   # buildServer(deps) (testável com inject) + bootstrap
  src/config.ts                   # env validado com Zod
  src/plugins/auth.ts             # verificação do JWT do Supabase → request.userId
  src/domain/types.ts             # Product, Nutrition, Profile, ScoreResult, AlertReport…
  src/domain/barcode.ts           # normalizeBarcode
  src/domain/score.ts             # computeBaseScore  (+ SCORE_VERSION)
  src/domain/additives.ts         # dicionário + detectAdditives + additivePenalty
  src/domain/allergens.ts         # dicionário + detectAlerts
  src/domain/analysis.ts          # analyzeProduct
  src/integrations/off.ts         # fetch do OFF (timeout 5 s) + mapOffProduct (puro)
  src/repositories/               # interfaces + implementações Prisma (products, profiles, history)
  src/routes/                     # scans, products, profile, history, account
  src/**/__tests__/               # Vitest
supabase/
  config.toml                     # existente; só Auth (anonymous sign-ins ligado)
```

---

### Task 1: Scaffold do projeto (app e supabase já existem; criar `api/`)

**Estado atual (preservar):** `app/` criado com Expo SDK 58, expo-router, expo-camera, supabase-js, async-storage, jest-expo; `supabase/config.toml` existe; `app/src/domain/__tests__/smoke.test.ts` existe.

**Files:**
- Create: `api/` (Fastify + TypeScript + Vitest), `api/.env.example`, `api/src/server.ts`, `api/src/config.ts`
- Modify: `supabase/config.toml` (`enable_anonymous_sign_ins = true`), `.gitignore`, `CLAUDE.md` e o spec (arquitetura nova)
- Test: `api/src/__tests__/health.test.ts`

**Interfaces:**
- Produces: `buildServer(deps): FastifyInstance` e `GET /health → 200 { ok: true }`; comandos `npm test` (Vitest), `npm run dev`, `npm run typecheck` em `api/`.

- [ ] **Step 1: Confirmar** que `npm test` em `app/` passa (smoke) e que o git está íntegro; não alterar o que já existe.
- [ ] **Step 2: Criar `api/`** com `fastify`, `@fastify/cors`, `@fastify/rate-limit`, `@fastify/swagger`, `fastify-type-provider-zod`, `zod`, `jose`, `@prisma/client`, e dev `prisma`, `typescript`, `tsx`, `vitest`, `@types/node`. ESM, `strict: true`.
- [ ] **Step 3: Escrever `health.test.ts`** (`app.inject({ url: '/health' })` → 200) — FAIL; implementar `buildServer` e `config.ts` (env validado; falha clara se faltar variável) — PASS.
- [ ] **Step 4:** em `supabase/config.toml` definir `enable_anonymous_sign_ins = true`; criar `api/.env.example` com todas as variáveis (sem valores reais); garantir `api/.env` no `.gitignore`.
- [ ] **Step 5:** atualizar `CLAUDE.md` (comandos e arquitetura da `api/`, remoção de Edge Functions/Deno/pgTAP) e a seção de arquitetura do spec.
- [ ] **Step 6: Commit** — `chore: scaffold da api fastify`.

---

### Task 2: Nota base determinística (em `api/src/domain/`)

**Files:**
- Create: `api/src/domain/types.ts`, `api/src/domain/score.ts`
- Test: `api/src/domain/__tests__/score.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `Nutrition = { energyKcal?: number; sugarsG?: number; addedSugarsG?: number; saturatedFatG?: number; sodiumMg?: number; fiberG?: number; proteinG?: number }` (por 100 g ou 100 ml)
  - `Product = { barcode: string; name: string; brand?: string; category?: string; isLiquid: boolean; nutrition: Nutrition; ingredientsText?: string; allergensTags: string[]; tracesTags: string[]; additivesTags: string[]; source: 'off' | 'user'; verified: boolean }`
  - `Band = 'excelente' | 'bom' | 'regular' | 'ruim'`
  - `ScoreResult = { status: 'ok'; score: number; band: Band; warnings: Warning[]; positives: string[]; negatives: string[]; breakdown: BreakdownItem[] } | { status: 'insufficient_data' }`
  - `Warning = { nutrient: 'acucar_adicionado' | 'gordura_saturada' | 'sodio'; label: string }` (rótulo ex.: "Alto em sódio")
  - `BreakdownItem = { label: string; points: number; approximated?: boolean }`
- Produces (`score.ts`): `SCORE_VERSION = '1'` e `computeBaseScore(product: Product, additivePenalty?: number): ScoreResult` (`additivePenalty` vem da Task 3, padrão 0, já limitado a 20). **A assinatura não aceita `Profile`**: o perfil não pode alterar a nota.
- Fórmula (inalterada da rev. 1): começa em 100. Para cada um entre açúcar, gordura saturada e sódio: `ratio = valor / limite_da_lupa`; penalidade `min(30, round(25 * ratio))`. Açúcar usa `addedSugarsG ?? sugarsG` (marcar `approximated: true` no breakdown quando usar `sugarsG`). Bônus: +5 se `fiberG ≥ 3`, +5 se `proteinG ≥ 5`. Subtrai `additivePenalty`. Limita a 0–100. Faixas: ≥80 excelente, ≥60 bom, ≥40 regular, senão ruim. `warnings` inclui o nutriente quando `valor ≥ limite`. Se açúcar, gordura saturada e sódio estão todos ausentes → `insufficient_data`; nutriente isolado ausente não penaliza.

- [ ] **Step 1: Escrever testes** em `score.test.ts`:
  - sólido com `addedSugarsG: 15, saturatedFatG: 0, sodiumMg: 0` → score 75, `warnings` contém `acucar_adicionado`.
  - líquido com `addedSugarsG: 7.5` → mesma penalidade (25) que o sólido com 15 g (limites distintos).
  - `sugarsG: 15` sem `addedSugarsG` → breakdown do açúcar com `approximated: true`.
  - produto só com `name` e `nutrition: {}` → `{ status: 'insufficient_data' }`.
  - valores enormes → score nunca < 0; produto ideal com fibra e proteína → nunca > 100.
  - 100 chamadas com a mesma entrada → resultado idêntico (`toEqual`).
  - `positives`/`negatives` em português simples (ex.: "Rico em fibras", "Muito sódio").
- [ ] **Step 2: Rodar** `npx vitest run score` (em `api/`) — Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implementar** `types.ts` e `computeBaseScore` em `score.ts`.
- [ ] **Step 4: Rodar** `npx vitest run score` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(api): nota base deterministica`.

---

### Task 3: Aditivos e adoçantes

**Files:**
- Create: `api/src/domain/additives.ts`
- Test: `api/src/domain/__tests__/additives.test.ts`

**Interfaces:**
- Consumes: `Product` (Task 2).
- Produces:
  - `AdditiveInfo = { code: string; name: string; category: 'corante' | 'conservante' | 'adocante' | 'realcador' | 'outro'; penalty: number; explanation: string; source: string }`
  - `detectAdditives(product: Pick<Product, 'ingredientsText' | 'additivesTags'>): AdditiveInfo[]` — une as tags do OFF (`en:e330`) e códigos achados no texto (`INS 330`, `E330`, por nome como "aspartame"); sem duplicatas.
  - `additivePenalty(found: AdditiveInfo[]): number` — soma das `penalty` limitada a 20.
- Dicionário inicial: ~30 aditivos mais comuns em alimentos brasileiros (corantes tartrazina/E102, amarelo crepúsculo/E110, corantes caramelo; conservantes benzoato/E211, sorbato/E202, nitrito/E250; adoçantes aspartame/E951, acessulfame K/E950, sucralose/E955, ciclamato/E952, sacarina/E954, estévia/E960; realçador glutamato/E621, etc.), `penalty` 0–10 e `source` obrigatória não vazia.

- [ ] **Step 1: Escrever testes:** tag `en:e951` encontra aspartame; texto "contém corante INS 102" encontra tartrazina; "ASPARTAME" em maiúsculas é detectado; mesmo aditivo por tag e texto aparece uma vez; todo item do dicionário tem `source` e `explanation` não vazios; `additivePenalty` de 5 aditivos de penalidade 10 → 20.
- [ ] **Step 2: Rodar** `npx vitest run additives` — Expected: FAIL.
- [ ] **Step 3: Implementar** dicionário e as duas funções.
- [ ] **Step 4: Rodar** `npx vitest run additives` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(api): dicionario de aditivos`.

---

### Task 4: Alertas de alergia e restrição por regras

**Files:**
- Create: `api/src/domain/allergens.ts`
- Modify: `api/src/domain/types.ts` (adicionar `Profile`, `AllergenAlert`, `AlertReport`)
- Test: `api/src/domain/__tests__/allergens.test.ts`

**Interfaces:**
- Produces (em `types.ts`):
  - `Allergen = 'leite' | 'ovo' | 'trigo' | 'soja' | 'amendoim' | 'castanhas' | 'peixe' | 'crustaceos' | 'gluten' | 'lactose'`
  - `Restriction = 'vegetariano' | 'vegano'`
  - `Profile = { goals: string[]; allergens: Allergen[]; restrictions: Restriction[]; lessSugar: boolean; lessSodium: boolean }`
  - `AllergenAlert = { kind: 'allergen' | 'restriction'; item: string; level: 'contem' | 'pode_conter'; reason: string }`
  - `AlertReport = { alerts: AllergenAlert[]; dataComplete: boolean; notice?: string }`
- Produces (`allergens.ts`): `detectAlerts(product: Product, profile: Profile): AlertReport`.
- Regras (inalteradas): combina `allergensTags`/`tracesTags` do OFF, dicionário de ingredientes em português (conforme RDC 727/2022) e "contém/pode conter" do texto; comparação sem acento e sem diferenciar maiúsculas. `dataComplete = false` quando não há `ingredientsText` nem `allergensTags` → `notice` "Dados incompletos: confira o rótulo". `source: 'user'` e `verified: false` → `notice` "dados enviados por usuário, confira o rótulo". Vegano/vegetariano: ingredientes de origem animal geram alerta `restriction`.

- [ ] **Step 1: Escrever testes:** perfil com `leite` + `allergensTags: ['en:milk']` → alerta `contem`; "SORO DE LEITE" sem tags → alerta `contem`; `tracesTags: ['en:nuts']` com perfil `castanhas` → `pode_conter`; "Amêndoas" com perfil `castanhas` → alerta; produto sem ingredientes e sem tags → `dataComplete: false` e `notice`; produto limpo e completo → `alerts: []`, `dataComplete: true`; `source: 'user'`, `verified: false` → `notice` de dado de usuário; perfil `vegano` + "gelatina" → alerta `restriction`.
- [ ] **Step 2: Rodar** `npx vitest run allergens` — Expected: FAIL.
- [ ] **Step 3: Implementar** `detectAlerts` e dicionário, com normalização (remover acentos, minúsculas).
- [ ] **Step 4: Rodar** `npx vitest run allergens` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(api): alertas de alergia por regras`.

---

### Task 5: Normalização de código de barras e `analyzeProduct`

**Files:**
- Create: `api/src/domain/barcode.ts`, `api/src/domain/analysis.ts`
- Test: `api/src/domain/__tests__/barcode.test.ts`, `api/src/domain/__tests__/analysis.test.ts`

**Interfaces:**
- Produces: `normalizeBarcode(raw: string): string | null` — retorna EAN-13 (12 dígitos UPC-A ganham `0` à frente; EAN-8 é mantido com 8 dígitos); `null` se não for numérico, tiver comprimento fora de 8/12/13 ou o dígito verificador estiver errado.
- Produces: `analyzeProduct(product: Product, profile: Profile | null): ProductAnalysis` — compõe `detectAdditives` → `additivePenalty` → `computeBaseScore` e `detectAlerts`; sem perfil, `alerts.alerts` vem vazio com `dataComplete` calculado normalmente; inclui `scoreVersion`.

- [ ] **Step 1: Escrever testes:** EAN-13 válido (`7891000100103`) volta igual; UPC-A válido de 12 dígitos vira 13 com `0`; EAN-8 válido fica com 8; dígito verificador errado → `null`; `"abc"`, `""`, 14 dígitos → `null`; espaços ao redor são removidos. `analyzeProduct`: produto com leite + perfil alérgico a leite → `alerts.alerts` não vazio e `score` idêntico ao do mesmo produto sem perfil (perfil nunca altera a nota); aditivos penalizam a nota via `additivePenalty`.
- [ ] **Step 2: Rodar** `npx vitest run barcode analysis` — Expected: FAIL.
- [ ] **Step 3: Implementar** `normalizeBarcode` (dígito verificador GS1) e `analyzeProduct`.
- [ ] **Step 4: Rodar** `npx vitest run` — Expected: PASS (todo o domínio).
- [ ] **Step 5: Commit** — `feat(api): barcode e analise de produto`.

---

### Task 6: Banco: Prisma schema, migrations e segurança

**Pré-requisito do fundador:** um projeto Supabase (nuvem) com Auth anônimo ligado; fornecer `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` em `api/.env` (nunca no chat nem no git). Sem isso, as Tasks 2–5 e os testes com repositórios falsos seguem normalmente; só a execução das migrations e dos testes de banco ficam pendentes.

**Files:**
- Create: `api/prisma/schema.prisma`, `api/prisma/migrations/0001_core/migration.sql`, `api/src/repositories/*.ts` (interfaces + implementações Prisma)
- Test: `api/src/repositories/__tests__/db.test.ts` (roda só com `TEST_DATABASE_URL`; caso contrário `describe.skip`)

**Interfaces:**
- Produces (tabelas, todas com RLS ligado, sem políticas para `anon`/`authenticated`; `REVOKE ALL` desses roles):
  - `profiles(user_id uuid pk → auth.users on delete cascade, goals text[], allergens text[], restrictions text[], less_sugar bool, less_sodium bool, health_consent_at timestamptz, updated_at)` — **CHECK**: não é possível gravar `allergens`/`restrictions`/`goals` não vazios com `health_consent_at` nulo.
  - `products(barcode text pk, name, brand, category, is_liquid bool, nutrition jsonb, ingredients_text, allergens_tags text[], traces_tags text[], additives_tags text[], source text check in ('off','user'), verified bool default false, created_at)`.
  - `scan_history(id uuid pk, user_id → auth.users on delete cascade, barcode → products, scanned_at)`.
  - Índice trigrama em `products.name` (`pg_trgm`) e função `search_products_by_name(q text, lim int default 20)`.
- Repositórios: `ProductRepository { findByBarcode, upsert, searchByName }`, `ProfileRepository { get(userId), upsert(userId, profile, consentAt) }`, `HistoryRepository { add(userId, barcode), list(userId) }` — todos os métodos de usuário recebem `userId` obrigatório.

- [ ] **Step 1: Escrever `db.test.ts`:** perfil com `allergens = ['leite']` e `health_consent_at` nulo falha (CHECK); usuário A não lê histórico/perfil do B via repositório; `searchByName('iogu')` encontra "Iogurte Natural"; apagar o usuário em `auth.users` apaga perfil e histórico; `products` aceita `upsert` idempotente (mesmo barcode, sem duplicar).
- [ ] **Step 2: Rodar** `npx vitest run db` — Expected: FAIL (com banco de teste) ou SKIP (sem).
- [ ] **Step 3: Escrever** `schema.prisma` e a migration `0001_core` (SQL manual para CHECK, `pg_trgm`, FK `auth.users`, RLS/REVOKE e função de busca); implementar os repositórios Prisma.
- [ ] **Step 4: Aplicar** `npx prisma migrate deploy` (via `DIRECT_URL`) e rodar `npx vitest run db` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(api): schema prisma, migrations e repositorios`.

---

### Task 7: Auth, integração OFF e rotas de produto

**Files:**
- Create: `api/src/plugins/auth.ts`, `api/src/integrations/off.ts`, `api/src/routes/scans.ts`, `api/src/routes/products.ts`
- Test: `api/src/plugins/__tests__/auth.test.ts`, `api/src/integrations/__tests__/off.test.ts`, `api/src/routes/__tests__/products.test.ts`

**Interfaces:**
- Consumes: domínio (Tasks 2–5), repositórios (Task 6).
- Produces:
  - Plugin de auth: valida `Authorization: Bearer` (JWKS do projeto; fallback HS256), exige `aud=authenticated`, expõe `request.userId`; falha → `401 { error: 'unauthorized' }`.
  - `mapOffProduct(off: unknown): Product | null` (puro, `source: 'off'`, `verified: true`). Converte `sodium_100g` (g) para mg; se só houver `salt_100g`, `sodiumMg = salt_100g * 400`; `isLiquid` vem de `quantity`/categorias (ml/l ou `en:beverages`); tags de alérgenos/traços/aditivos copiadas do OFF; campos ausentes não viram `0`.
  - `fetchOffProduct(barcode, { timeoutMs: 5000 })`.
  - `POST /v1/scans` `{ barcode }` → `200 ProductAnalysis` | `400 { error: 'invalid_barcode' }` | `404 { error: 'not_found' }` | `502 { error: 'upstream_unavailable' }`. Ordem: normaliza → banco próprio → OFF → grava produto → grava histórico → analisa com o perfil do usuário.
  - `GET /v1/products/:barcode` (mesmos códigos, sem histórico) e `GET /v1/products/search?q=` (mín. 2 caracteres, `200 { products: Product[] }`, só banco próprio nesta fase).

- [ ] **Step 1: Escrever testes:** auth — token válido assina com chave de teste e passa; ausente, expirado, assinatura errada e `aud` errado → 401. `mapOffProduct` — sódio em g → mg (`0.4` → 400); só `salt_100g: 1` → 400 mg; "Coca-Cola 350 ml" é líquido; `status: 0` ou sem `product` → `null`; ausentes permanecem indefinidos. Rotas (repositórios e OFF falsos) — `invalid_barcode` 400 sem chamar OFF; banco com hit não chama OFF; miss + OFF ok → grava e devolve 200; OFF 404 → 404; OFF timeout/erro → 502; `'07891000100103'` e `'7891000100103'` produzem o mesmo código; scan grava histórico, GET não; o perfil do usuário afeta `alerts` mas não `score`.
- [ ] **Step 2: Rodar** `npx vitest run` — Expected: FAIL.
- [ ] **Step 3: Implementar** auth, `off.ts` e as rotas, validando entrada e saída com Zod e publicando o OpenAPI em `/docs`.
- [ ] **Step 4: Rodar** `npx vitest run` — Expected: PASS.
- [ ] **Step 5: Verificar manualmente:** `npm run dev` e `curl` com JWT anônimo real: `POST /v1/scans` com `7891000100103` → 200 ou 404; `{"barcode":"123"}` → 400; sem token → 401.
- [ ] **Step 6: Commit** — `feat(api): auth, integracao off e rotas de produto`.

---

### Task 8: Perfil, consentimento LGPD, exclusão de conta e histórico (API)

**Files:**
- Create: `api/src/routes/profile.ts`, `api/src/routes/history.ts`, `api/src/routes/account.ts`
- Test: `api/src/routes/__tests__/profile.test.ts`, `history.test.ts`, `account.test.ts`

**Interfaces:**
- Consumes: `Profile` (Task 4), repositórios e auth (Tasks 6–7).
- Produces:
  - `GET /v1/profile` → `200 { profile: Profile | null, consentAt: string | null }`.
  - `PUT /v1/profile` `{ profile, consent }` → `200` | `422 { error: 'consent_required' }` se há dado de saúde sem `consent` (e sem consentimento prévio); grava `health_consent_at` ao consentir; perfil vazio sem consentimento é permitido (pular onboarding).
  - `GET /v1/history` → `200 { items: Array<{ product, scannedAt }> }` (só do usuário do JWT, mais recentes primeiro).
  - `DELETE /v1/account` → `204`; chama a Admin API do Supabase (`auth.admin.deleteUser(userId)`, service role só na API); cascata apaga perfil e histórico.

- [ ] **Step 1: Escrever testes:** `PUT` com alergias e `consent=false` → 422 e **nada gravado**; com `consent=true` grava `consentAt`; perfil vazio sem consentimento → 200; usuário A nunca vê perfil/histórico do B; `DELETE` chama `deleteUser` só com o `sub` do JWT (nunca um id vindo do corpo); sem token → 401.
- [ ] **Step 2: Rodar** `npx vitest run profile history account` — Expected: FAIL.
- [ ] **Step 3: Implementar** as rotas com Zod.
- [ ] **Step 4: Rodar** `npx vitest run` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(api): perfil, lgpd, historico e exclusao de conta`.

---

### Task 9: App: Auth anônimo, cliente da API e telas funcionais

**Files:**
- Create: `app/src/data/supabase.ts`, `app/src/api/client.ts`, `app/src/api/schema.ts` (gerado), `app/src/data/products.ts`, `app/src/data/profile.ts`, `app/src/data/history.ts`, `app/app/onboarding.tsx`, `app/app/settings.tsx`, `app/app/index.tsx` (scanner), `app/app/product/[barcode].tsx`, `app/app/search.tsx`, `app/app/history.tsx`
- Test: `app/src/api/__tests__/client.test.ts`, `app/src/data/__tests__/profile.test.ts`, `app/src/data/__tests__/products.test.ts`

**Interfaces:**
- Consumes: API v1 (Tasks 7–8) via tipos gerados (`openapi-typescript` a partir de `/docs/json`).
- Produces:
  - `ensureSession(): Promise<string>` (`signInAnonymously` só se não há sessão; persistida em AsyncStorage); o `access_token` é enviado em cada chamada.
  - `apiFetch` tipado: mapeia 400/404/422/502 e falha de rede para erros de domínio (`invalid`, `not_found`, `consent_required`, `error`); timeout e sem retry em escrita.
  - `scanProduct(raw)`, `getProduct(raw)`, `searchProducts(q)`, `loadProfile()`, `saveProfile(profile, consent)` (lança `ConsentRequiredError` antes da rede quando há dado de saúde e `consent` é falso), `deleteAccount()` (chama a API, `signOut` local), `listHistory()`.
  - **O app não importa nenhuma função de domínio**: nota, alertas e aditivos vêm prontos na resposta.
- Tela do produto: nome/marca; nota e faixa; **alertas de alergia/restrição no topo e em destaque**; warnings da lupa ANVISA; aditivos com explicação e fonte; positivos e negativos; aviso de dados incompletos/enviados por usuário; aviso "não substitui profissional"; `not_found` → "Produto não encontrado" (foto de rótulo vem em plano futuro); `insufficient_data` → "Dados insuficientes para dar uma nota".
- Onboarding (objetivo, alergias, restrições, açúcar/sódio, checkbox LGPD com finalidade, aviso, "Pular") e settings ("Excluir minha conta e dados" com confirmação).

- [ ] **Step 1: Escrever testes** (`fetch` e Supabase mockados): `saveProfile` com alergias e `consent=false` lança `ConsentRequiredError` sem chamar a rede; com `consent=true` envia `consent: true`; `ensureSession` chama `signInAnonymously` só sem sessão; `getProduct('abc')` não chama a rede quando a API responde `invalid_barcode`… (o app apenas repassa o texto; a validação autoritativa é do servidor) e 404 → `not_found`, 502 ou rede caindo → `error`; header `Authorization` presente.
- [ ] **Step 2: Rodar** `npx jest` (em `app/`) — Expected: FAIL.
- [ ] **Step 3: Implementar** `supabase.ts`, `client.ts` e os módulos de dados; gerar `schema.ts`.
- [ ] **Step 4: Rodar** `npx jest` — Expected: PASS.
- [ ] **Step 5: Implementar as telas** (scanner com `expo-camera` e `barcodeScannerSettings` para EAN-13/EAN-8/UPC-A, produto, busca com debounce, histórico, onboarding, settings).
- [ ] **Step 6: Verificar no aparelho/emulador Android** com a API rodando (`EXPO_PUBLIC_API_URL`): onboarding bloqueia alergia sem consentimento; perfil persiste; 3 produtos conhecidos (um com leite, um sem dados de alérgenos, um inexistente): alerta de leite no topo, "Dados incompletos", "Produto não encontrado"; modo avião mostra erro tratável; "Excluir minha conta" volta ao onboarding.
- [ ] **Step 7: Commit** — `feat(app): auth anonimo, cliente da api e telas funcionais`.

---

### Task 10: Deploy da API e fechamento

**Files:**
- Create: `api/Dockerfile`, `api/README.md` (variáveis, `prisma migrate deploy`, health check)

- [ ] **Step 1: Dockerfile** multi-stage (Node 22 slim, `prisma generate`, usuário não-root), `HEALTHCHECK` em `/health`.
- [ ] **Step 2: Decidir o provedor** (Railway, Render ou Fly.io) com o fundador e publicar; configurar secrets no provedor; rodar `prisma migrate deploy` no release.
- [ ] **Step 3: Verificar** `curl https://<api>/health` e o fluxo completo do app contra a URL pública (EAS preview).
- [ ] **Step 4: Commit** — `chore(api): dockerfile e deploy`.

---

## Self-Review

- **Cobertura do spec (escopo do plano 1):** scanner e busca (T5, T7, T9); nota 0–100 e faixas (T2); alertas ANVISA (T2); aditivos com fonte (T3); positivos/negativos (T2); perfil e alertas em destaque (T4, T8, T9); histórico (T6, T8, T9); conta anônima, LGPD, exclusão (T6, T8, T9); chaves só no backend e isolamento por `user_id` (T6–T8); backend publicado (T10).
- **Consistência de tipos:** `Product`, `Profile`, `ScoreResult`, `AlertReport` definidos em T2/T4 e usados com os mesmos nomes em T5–T9; o app recebe esses tipos pelo OpenAPI, não por cópia manual.
- **Ponto aberto da rev. 1, resolvido:** a nota vive só em `api/src/domain/`; importação em massa e alternativas do Pomo+ reutilizam `computeBaseScore` (com `scoreVersion` para reprocessar quando a fórmula mudar).
- **Tradeoffs aceitos:** mais um serviço para operar e hospedar (custo e disponibilidade da API); o app não funciona offline para análise (antes também dependia de rede para o produto); latência de um salto extra (app → API → banco/OFF).
- **Limitação conhecida:** o OFF traz açúcares totais, não açúcar adicionado; a nota usa `sugarsG` como aproximação marcada no breakdown.
