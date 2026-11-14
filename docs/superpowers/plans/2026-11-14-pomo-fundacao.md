# Pomo AI — Plano 1: Fundação do MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o núcleo grátis do Pomo: conta anônima, perfil com consentimento LGPD, scan/busca de produto, nota base determinística, alertas de alergia por regras, aditivos e histórico.

**Architecture:** App Expo (TypeScript) com toda a lógica de domínio (nota, aditivos, alérgenos) em funções puras testadas com Jest. Supabase guarda perfil, produtos e histórico com RLS; uma Edge Function consulta o Open Food Facts (OFF), normaliza e grava o produto no banco próprio.

**Tech Stack:** Expo (React Native, TypeScript, expo-router, expo-camera), Jest (jest-expo), Supabase (Postgres, Auth anônima, Edge Functions em Deno), pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-14-pomo-ai-design.md`

**Fora deste plano (planos seguintes):** Pomo+ (leitura personalizada, alternativas, chat, comparação, RevenueCat), foto de rótulo com Gemini, mascote, design system/telas finais, importação em massa do OFF, fila de revisão de produtos, envio de contribuições ao OFF. As telas deste plano são funcionais e sem identidade visual.

## Global Constraints

- Idioma de toda a interface e textos: português do Brasil.
- Plataforma: Android primeiro; nada que bloqueie iOS (só APIs do Expo SDK).
- Nota base: 0–100, determinística, sem IA; faixas "excelente", "bom", "regular", "ruim".
- Limites da lupa ANVISA (RDC 429/2020, IN 75/2020), por 100 g (sólidos) / 100 ml (líquidos): açúcar adicionado ≥ 15 g / 7,5 g; gordura saturada ≥ 6 g / 3 g; sódio ≥ 600 mg / 300 mg.
- Alerta de alergia nunca depende de IA; dados incompletos nunca viram "seguro".
- Dados de saúde (alergias, restrições, objetivos) só são gravados após consentimento LGPD explícito; a pessoa pode excluir conta e dados.
- Cada explicação de aditivo cita a fonte (EFSA/JECFA/ANVISA).
- Aviso "o app informa e orienta, não substitui um profissional" visível no onboarding e na tela do produto.
- Produto de origem `user` e não verificado mostra "dados enviados por usuário, confira o rótulo" junto aos alertas.
- Chaves de serviço (service role) só no backend; o app usa apenas a chave anônima.

## Review Focus

- Código de barras: EAN-8, EAN-13 e UPC-A (12 dígitos) chegam normalizados; zeros à esquerda não criam produtos duplicados; leitura inválida é rejeitada.
- Produto sem campos nutricionais suficientes: resultado "dados insuficientes", nunca nota 0 nem 100.
- Alérgenos: maiúsculas/minúsculas e acentos ("LEITE", "Amêndoa"), "pode conter" (traços) e ausência total de dados de alérgenos (→ "dados incompletos", não "seguro").
- OFF fora do ar, lento ou 404: o app mostra "produto não encontrado"/erro tratável, sem travar; OFF entrega sódio em gramas e sal separadamente (conversão para mg).
- Mesmo produto pontuado duas vezes dá resultado idêntico; líquido e sólido usam limites diferentes.

## File Structure

```
app/                              # Expo
  app/                            # rotas expo-router (onboarding, scan, product/[barcode], history, search, settings)
  src/domain/types.ts             # Product, Nutrition, Profile, ScoreResult, AllergenAlert
  src/domain/barcode.ts           # normalizeBarcode
  src/domain/score.ts             # computeBaseScore
  src/domain/additives.ts         # dicionário + detectAdditives
  src/domain/allergens.ts         # dicionário + detectAllergens
  src/data/supabase.ts            # client, anonymous auth
  src/data/products.ts            # getProduct, searchProducts
  src/data/profile.ts             # load/save profile + consent, deleteAccount
  src/data/history.ts             # addScan, listHistory
supabase/
  migrations/0001_core.sql        # profiles, products, scan_history, RLS
  tests/rls.test.sql              # pgTAP
  functions/_shared/off-mapper.ts # mapOffProduct (puro)
  functions/_shared/off-mapper.test.ts
  functions/lookup-product/index.ts
  functions/search-products/index.ts
  functions/delete-account/index.ts
```

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `app/` (Expo TypeScript), `supabase/config.toml`, `.gitignore`
- Test: `app/src/domain/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: comando `npm test` (em `app/`) rodando Jest; repositório git inicializado na raiz; Supabase CLI inicializado com auth anônima habilitada.

- [ ] **Step 1: Inicializar git na raiz** e criar `.gitignore` (node_modules, .env*, .expo, supabase/.temp).
- [ ] **Step 2: Criar o app** com `npx create-expo-app@latest app --template blank-typescript`, adicionar `expo-router`, `expo-camera`, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, e devDependencies `jest-expo`, `@types/jest`; configurar `"test": "jest"` com preset `jest-expo`.
- [ ] **Step 3: Escrever `smoke.test.ts`** com `expect(1 + 1).toBe(2)`; rodar `npm test` em `app/`. Expected: PASS.
- [ ] **Step 4: `npx supabase init`** na raiz e, em `supabase/config.toml`, definir `[auth] enable_anonymous_sign_ins = true`.
- [ ] **Step 5: Commit** — `chore: scaffold expo app and supabase`.

---

### Task 2: Nota base determinística

**Files:**
- Create: `app/src/domain/types.ts`, `app/src/domain/score.ts`
- Test: `app/src/domain/__tests__/score.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `Nutrition = { energyKcal?: number; sugarsG?: number; addedSugarsG?: number; saturatedFatG?: number; sodiumMg?: number; fiberG?: number; proteinG?: number }` (por 100 g ou 100 ml)
  - `Product = { barcode: string; name: string; brand?: string; category?: string; isLiquid: boolean; nutrition: Nutrition; ingredientsText?: string; allergensTags: string[]; tracesTags: string[]; additivesTags: string[]; source: 'off' | 'user'; verified: boolean }`
  - `Band = 'excelente' | 'bom' | 'regular' | 'ruim'`
  - `ScoreResult = { status: 'ok'; score: number; band: Band; warnings: Warning[]; positives: string[]; negatives: string[]; breakdown: BreakdownItem[] } | { status: 'insufficient_data' }`
  - `Warning = { nutrient: 'acucar_adicionado' | 'gordura_saturada' | 'sodio'; label: string }` (rótulo ex.: "Alto em sódio")
  - `BreakdownItem = { label: string; points: number; approximated?: boolean }`
- Produces (`score.ts`): `computeBaseScore(product: Product, additivePenalty?: number): ScoreResult` (`additivePenalty` vem da Task 3, padrão 0, já limitado a 20).
- Fórmula (decidida aqui): começa em 100. Para cada um entre açúcar, gordura saturada e sódio: `ratio = valor / limite_da_lupa`; penalidade `min(30, round(25 * ratio))`. Açúcar usa `addedSugarsG ?? sugarsG` (marcar `approximated: true` no breakdown quando usar `sugarsG`). Bônus: +5 se `fiberG ≥ 3`, +5 se `proteinG ≥ 5`. Subtrai `additivePenalty`. Limita a 0–100. Faixas: ≥80 excelente, ≥60 bom, ≥40 regular, senão ruim. `warnings` inclui o nutriente quando `valor ≥ limite`. Se açúcar, gordura saturada e sódio estão todos ausentes → `insufficient_data`; nutriente isolado ausente não penaliza.

- [ ] **Step 1: Escrever testes** em `score.test.ts`:
  - sólido com `addedSugarsG: 15, saturatedFatG: 0, sodiumMg: 0` → score 75, `warnings` contém `acucar_adicionado`.
  - líquido com `addedSugarsG: 7.5` → mesma penalidade (25) que o sólido com 15 g (limites distintos).
  - `sugarsG: 15` sem `addedSugarsG` → breakdown do açúcar com `approximated: true`.
  - produto só com `name` e `nutrition: {}` → `{ status: 'insufficient_data' }`.
  - valores enormes → score nunca < 0; produto ideal com fibra e proteína → nunca > 100.
  - 100 chamadas com a mesma entrada → resultado idêntico (`toEqual`).
  - `positives`/`negatives` em português simples (ex.: "Rico em fibras", "Muito sódio").
- [ ] **Step 2: Rodar** `npx jest score` — Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implementar** `computeBaseScore` conforme a fórmula acima, em `score.ts`.
- [ ] **Step 4: Rodar** `npx jest score` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat: nota base deterministica`.

---

### Task 3: Aditivos e adoçantes

**Files:**
- Create: `app/src/domain/additives.ts`
- Test: `app/src/domain/__tests__/additives.test.ts`

**Interfaces:**
- Consumes: `Product` (Task 2).
- Produces:
  - `AdditiveInfo = { code: string; name: string; category: 'corante' | 'conservante' | 'adocante' | 'realcador' | 'outro'; penalty: number; explanation: string; source: string }`
  - `detectAdditives(product: Pick<Product, 'ingredientsText' | 'additivesTags'>): AdditiveInfo[]` — une as tags do OFF (`en:e330`) e códigos achados no texto (`INS 330`, `E330`, por nome como "aspartame"); sem duplicatas.
  - `additivePenalty(found: AdditiveInfo[]): number` — soma das `penalty` limitada a 20.
- Dicionário inicial: ~30 aditivos mais comuns em alimentos brasileiros (corantes tartrazina/E102, amarelo crepúsculo/E110, corantes caramelo; conservantes benzoato/E211, sorbato/E202, nitrito/E250; adoçantes aspartame/E951, acessulfame K/E950, sucralose/E955, ciclamato/E952, sacarina/E954, estévia/E960; realçador glutamato/E621, etc.), `penalty` 0–10 e `source` obrigatória não vazia.

- [ ] **Step 1: Escrever testes:** tag `en:e951` encontra aspartame; texto "contém corante INS 102" encontra tartrazina; "ASPARTAME" em maiúsculas é detectado; mesmo aditivo por tag e texto aparece uma vez; todo item do dicionário tem `source` e `explanation` não vazios; `additivePenalty` de 5 aditivos de penalidade 10 → 20.
- [ ] **Step 2: Rodar** `npx jest additives` — Expected: FAIL.
- [ ] **Step 3: Implementar** dicionário e as duas funções em `additives.ts`.
- [ ] **Step 4: Rodar** `npx jest additives` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat: dicionario de aditivos`.

---

### Task 4: Alertas de alergia e restrição por regras

**Files:**
- Create: `app/src/domain/allergens.ts`
- Modify: `app/src/domain/types.ts` (adicionar `Profile`, `AllergenAlert`)
- Test: `app/src/domain/__tests__/allergens.test.ts`

**Interfaces:**
- Produces (em `types.ts`):
  - `Allergen = 'leite' | 'ovo' | 'trigo' | 'soja' | 'amendoim' | 'castanhas' | 'peixe' | 'crustaceos' | 'gluten' | 'lactose'`
  - `Restriction = 'vegetariano' | 'vegano'`
  - `Profile = { goals: string[]; allergens: Allergen[]; restrictions: Restriction[]; lessSugar: boolean; lessSodium: boolean }`
  - `AllergenAlert = { kind: 'allergen' | 'restriction'; item: string; level: 'contem' | 'pode_conter'; reason: string }`
  - `AlertReport = { alerts: AllergenAlert[]; dataComplete: boolean; notice?: string }`
- Produces (`allergens.ts`): `detectAlerts(product: Product, profile: Profile): AlertReport`.
- Regras: combina `allergensTags`/`tracesTags` do OFF (`en:milk`…), dicionário de ingredientes em português (leite, soro de leite, caseína, manteiga, ovo, farinha de trigo, soja, lecitina de soja, amendoim, amêndoa, castanha, etc., conforme RDC 727/2022) e "contém/pode conter" do texto. Comparação sem acento e sem diferenciar maiúsculas. `dataComplete = false` quando o produto não tem `ingredientsText` nem `allergensTags` → `notice` "Dados incompletos: confira o rótulo". Produto `source: 'user'` e `verified: false` → `notice` "dados enviados por usuário, confira o rótulo". Vegano/vegetariano: ingredientes de origem animal (carne, gelatina, leite, ovo, mel…) geram alerta `restriction`.

- [ ] **Step 1: Escrever testes:** perfil com `leite` + produto com `allergensTags: ['en:milk']` → alerta `contem`; ingrediente "SORO DE LEITE" sem tags → alerta `contem`; `tracesTags: ['en:nuts']` com perfil `castanhas` → `pode_conter`; "Amêndoas" com perfil `castanhas` → alerta; produto sem ingredientes e sem tags → `dataComplete: false` e `notice` (nunca lista vazia "segura" sem aviso); produto limpo e completo → `alerts: []`, `dataComplete: true`; produto `source: 'user'`, `verified: false` → `notice` de dado de usuário; perfil `vegano` + "gelatina" → alerta `restriction`.
- [ ] **Step 2: Rodar** `npx jest allergens` — Expected: FAIL.
- [ ] **Step 3: Implementar** `detectAlerts` e dicionário em `allergens.ts`, com função interna de normalização (remover acentos, minúsculas).
- [ ] **Step 4: Rodar** `npx jest allergens` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat: alertas de alergia por regras`.

---

### Task 5: Normalização de código de barras

**Files:**
- Create: `app/src/domain/barcode.ts`
- Test: `app/src/domain/__tests__/barcode.test.ts`

**Interfaces:**
- Produces: `normalizeBarcode(raw: string): string | null` — retorna EAN-13 (12 dígitos UPC-A ganham `0` à frente; EAN-8 é mantido com 8 dígitos); `null` se não for numérico, tiver comprimento fora de 8/12/13 ou o dígito verificador estiver errado.

- [ ] **Step 1: Escrever testes:** EAN-13 válido (`7891000100103`) volta igual; UPC-A válido de 12 dígitos vira 13 com `0`; EAN-8 válido fica com 8; dígito verificador errado → `null`; `"abc"`, `""`, 14 dígitos → `null`; espaços ao redor são removidos.
- [ ] **Step 2: Rodar** `npx jest barcode` — Expected: FAIL.
- [ ] **Step 3: Implementar** `normalizeBarcode` (dígito verificador padrão GS1).
- [ ] **Step 4: Rodar** `npx jest barcode` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat: normalizacao de codigo de barras`.

---

### Task 6: Banco Supabase e segurança (RLS)

**Files:**
- Create: `supabase/migrations/0001_core.sql`, `supabase/tests/rls.test.sql`

**Interfaces:**
- Produces (tabelas, todas com RLS ligado):
  - `profiles(user_id uuid pk → auth.users on delete cascade, goals text[], allergens text[], restrictions text[], less_sugar bool, less_sodium bool, health_consent_at timestamptz, updated_at)` — o dono lê/escreve só a própria linha; **não** é possível gravar `allergens`/`restrictions`/`goals` não vazios com `health_consent_at` nulo (CHECK).
  - `products(barcode text pk, name, brand, category, is_liquid bool, nutrition jsonb, ingredients_text, allergens_tags text[], traces_tags text[], additives_tags text[], source text check in ('off','user'), verified bool default false, created_at)` — leitura para qualquer usuário autenticado (inclusive anônimo); escrita só por service role.
  - `scan_history(id uuid pk, user_id → auth.users on delete cascade, barcode → products, scanned_at)` — o dono lê/insere só os próprios.
  - Índice trigrama em `products.name` (`pg_trgm`) e função `search_products_by_name(q text, lim int default 20) returns setof products`.

- [ ] **Step 1: Escrever `rls.test.sql` (pgTAP):** usuário A não lê o perfil do usuário B; usuário autenticado não insere em `products`; inserir `profiles` com `allergens = '{leite}'` e `health_consent_at` nulo falha; apagar o usuário em `auth.users` apaga seu perfil e histórico; `search_products_by_name('iogu')` encontra "Iogurte Natural".
- [ ] **Step 2: Rodar** `npx supabase test db` — Expected: FAIL (tabelas não existem).
- [ ] **Step 3: Escrever `0001_core.sql`** com as tabelas, políticas, índice e função descritos.
- [ ] **Step 4: Rodar** `npx supabase db reset && npx supabase test db` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat: schema supabase com RLS`.

---

### Task 7: Lookup de produto (Edge Functions)

**Files:**
- Create: `supabase/functions/_shared/off-mapper.ts`, `supabase/functions/lookup-product/index.ts`, `supabase/functions/search-products/index.ts`
- Test: `supabase/functions/_shared/off-mapper.test.ts`

**Interfaces:**
- Consumes: tabela `products` e `search_products_by_name` (Task 6); regra de barcode da Task 5 (reimplementar a mesma validação em Deno em `_shared/barcode.ts`, copiando os casos de teste).
- Produces:
  - `mapOffProduct(off: unknown): ProductRow | null` (puro; mesmo formato da tabela `products`, `source: 'off'`, `verified: true`). Converte `sodium_100g` (g) para mg; se só houver `salt_100g`, `sodio_mg = salt_100g * 400`; `is_liquid` vem de `quantity`/categorias (ml/l ou `en:beverages`); tags de alérgenos/traços/aditivos copiadas do OFF.
  - `POST /functions/v1/lookup-product` com `{ barcode }` → `200 { product }` | `404 { error: 'not_found' }` | `400 { error: 'invalid_barcode' }` | `502 { error: 'upstream_unavailable' }`. Ordem: banco próprio → OFF (timeout de 5 s) → grava o produto com service role.
  - `POST /functions/v1/search-products` com `{ q }` (mín. 2 caracteres) → `200 { products: ProductRow[] }` (apenas banco próprio nesta fase).

- [ ] **Step 1: Escrever `off-mapper.test.ts`** (`deno test`): sódio em g → mg (`sodium_100g: 0.4` → 400); só `salt_100g: 1` → 400 mg; "Coca-Cola 350 ml" é líquido; resposta com `status: 0` ou sem `product` → `null`; campos ausentes não viram `0` (permanecem indefinidos no `nutrition`).
- [ ] **Step 2: Rodar** `deno test supabase/functions/_shared` — Expected: FAIL.
- [ ] **Step 3: Implementar** `mapOffProduct` e `_shared/barcode.ts`.
- [ ] **Step 4: Rodar** `deno test supabase/functions/_shared` — Expected: PASS.
- [ ] **Step 5: Implementar** as duas funções (`index.ts`) com os códigos de resposta acima; falha ou timeout do OFF → `502`, nunca exceção não tratada.
- [ ] **Step 6: Verificar manualmente:** `npx supabase functions serve` e `curl -X POST .../lookup-product -d '{"barcode":"7891000100103"}'` retorna 200 ou 404; `{"barcode":"123"}` retorna 400.
- [ ] **Step 7: Commit** — `feat: edge functions de lookup e busca`.

---

### Task 8: Conta anônima, perfil e consentimento LGPD

**Files:**
- Create: `app/src/data/supabase.ts`, `app/src/data/profile.ts`, `supabase/functions/delete-account/index.ts`, `app/app/onboarding.tsx`, `app/app/settings.tsx`
- Test: `app/src/data/__tests__/profile.test.ts`

**Interfaces:**
- Consumes: `Profile` (Task 4), tabela `profiles` (Task 6).
- Produces:
  - `getClient(): SupabaseClient` e `ensureSession(): Promise<string>` (retorna o `user_id`, usando `signInAnonymously` se não há sessão; sessão persistida em AsyncStorage).
  - `loadProfile(): Promise<Profile | null>`; `saveProfile(profile: Profile, consent: boolean): Promise<void>` — lança `ConsentRequiredError` se há dados de saúde e `consent` é falso; grava `health_consent_at` ao consentir.
  - `deleteAccount(): Promise<void>` — chama a Edge Function `delete-account` (service role apaga o usuário; cascata apaga perfil e histórico) e limpa a sessão local.
- Telas: `onboarding` (objetivo, alergias, restrições, preferência açúcar/sódio, checkbox de consentimento LGPD com finalidade descrita, aviso "não substitui profissional", botão "Pular") e `settings` (editar perfil, "Excluir minha conta e dados" com confirmação).

- [ ] **Step 1: Escrever testes** (client Supabase mockado): `saveProfile` com alergias e `consent=false` lança `ConsentRequiredError` e não chama o banco; com `consent=true` grava `health_consent_at`; perfil vazio sem consentimento é permitido (pular onboarding); `ensureSession` chama `signInAnonymously` só quando não há sessão.
- [ ] **Step 2: Rodar** `npx jest profile` — Expected: FAIL.
- [ ] **Step 3: Implementar** `supabase.ts` e `profile.ts`.
- [ ] **Step 4: Rodar** `npx jest profile` — Expected: PASS.
- [ ] **Step 5: Implementar** a Edge Function `delete-account` (valida o JWT do chamador e apaga só o próprio usuário) e as telas `onboarding` e `settings`.
- [ ] **Step 6: Verificar no emulador Android:** abrir o app → onboarding; marcar alergia sem consentir → botão bloqueado; consentir e salvar → perfil persiste após reabrir; "Excluir minha conta" apaga e volta ao onboarding.
- [ ] **Step 7: Commit** — `feat: conta anonima, perfil e consentimento LGPD`.

---

### Task 9: Scan, tela do produto, busca e histórico

**Files:**
- Create: `app/src/data/products.ts`, `app/src/data/history.ts`, `app/app/index.tsx` (scanner), `app/app/product/[barcode].tsx`, `app/app/search.tsx`, `app/app/history.tsx`
- Test: `app/src/data/__tests__/products.test.ts`, `app/src/domain/__tests__/analysis.test.ts`
- Create: `app/src/domain/analysis.ts`

**Interfaces:**
- Consumes: `normalizeBarcode` (Task 5), `computeBaseScore` (Task 2), `detectAdditives` e `additivePenalty` (Task 3), `detectAlerts` (Task 4), Edge Functions (Task 7).
- Produces:
  - `analyzeProduct(product: Product, profile: Profile | null): { score: ScoreResult; additives: AdditiveInfo[]; alerts: AlertReport }` (`analysis.ts`; sem perfil, `alerts` vem vazio com `dataComplete` calculado normalmente).
  - `getProduct(rawBarcode: string): Promise<{ kind: 'found'; product: Product } | { kind: 'not_found' } | { kind: 'invalid' } | { kind: 'error' }>`; `searchProducts(q: string): Promise<Product[]>`.
  - `addScan(barcode: string): Promise<void>`; `listHistory(): Promise<Array<{ product: Product; scannedAt: string }>>`.
- Tela do produto: nome/marca; nota e faixa; **alertas de alergia/restrição no topo e em destaque**; warnings da lupa ANVISA; aditivos com explicação e fonte; positivos e negativos; aviso de dados incompletos/enviados por usuário; aviso "não substitui profissional". `not_found` mostra "Produto não encontrado" (a foto de rótulo vem em plano futuro). Cada produto aberto entra no histórico.

- [ ] **Step 1: Escrever testes:** `analyzeProduct` — produto com leite + perfil alérgico a leite → `alerts.alerts` não vazio e score igual ao do mesmo produto sem perfil (perfil nunca altera a nota); `getProduct('abc')` → `invalid` sem chamar a rede; função remota respondendo 404 → `not_found`; respondendo 502 ou rede caindo → `error`; `getProduct('07891000100103')` e `'7891000100103'` chamam a função com o mesmo código normalizado.
- [ ] **Step 2: Rodar** `npx jest analysis products` — Expected: FAIL.
- [ ] **Step 3: Implementar** `analysis.ts`, `products.ts`, `history.ts`.
- [ ] **Step 4: Rodar** `npx jest` (suíte completa) — Expected: PASS.
- [ ] **Step 5: Implementar as telas** (scanner com `expo-camera` e `barcodeScannerSettings` para EAN-13/EAN-8/UPC-A, tela do produto, busca por nome com debounce, histórico).
- [ ] **Step 6: Verificar no aparelho/emulador Android** com 3 produtos conhecidos (um com leite, um sem dados de alérgenos, um inexistente): o alerta de leite aparece no topo para quem tem a alergia; o produto sem dados mostra "Dados incompletos"; o inexistente mostra "Produto não encontrado" sem travar; modo avião mostra erro tratável.
- [ ] **Step 7: Commit** — `feat: scan, tela do produto, busca e historico`.

---

## Self-Review

- **Cobertura do spec (escopo do plano 1):** scanner e busca (T5, T7, T9); nota 0–100 e faixas (T2); alertas ANVISA (T2); aditivos com fonte (T3); positivos/negativos (T2); perfil e alertas de alergia em destaque (T4, T8, T9); histórico (T6, T9); conta anônima, LGPD, exclusão (T6, T8); RLS e chave só no backend (T6, T7). Itens do spec fora deste plano estão listados no topo.
- **Consistência de tipos:** `Product`, `Profile`, `ScoreResult`, `AlertReport` definidos em T2/T4 e usados com os mesmos nomes em T9.
- **Ponto aberto para o plano de importação em massa:** a nota é calculada no app (T2). A importação com "nota pré-calculada" e as alternativas por consulta no banco vão precisar da mesma fórmula no backend; decidir lá entre mover `score.ts`/`additives.ts` para um pacote compartilhado ou duplicar em Deno.
- **Limitação conhecida:** o OFF traz açúcares totais, não açúcar adicionado; a nota usa `sugarsG` como aproximação marcada no breakdown.
