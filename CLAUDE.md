# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O projeto

Pomo AI: app Android (Expo/React Native, iOS depois) para o Brasil que escaneia alimentos, dá uma nota base 0–100 e alerta alergias. Camada paga "Pomo+" (leitura personalizada, alternativas, chat com Gemini) vem em planos posteriores. Toda a interface é em português do Brasil.

Documentos que mandam no código (leia antes de mudanças de produto):
- Spec (autoridade): `docs/superpowers/specs/2026-11-14-pomo-ai-design.md`
- Plano em execução (fundação, 9 tarefas): `docs/superpowers/plans/2026-11-14-pomo-fundacao.md`
- `app/AGENTS.md`: regras do Expo — **Expo SDK 58; não confiar em memória de APIs do Expo**, consultar `https://docs.expo.dev/versions/v58.0.0/`; sempre `npx expo install <pkg>` em vez de `npm install`; nunca editar `android/`/`ios/` à mão.

## Estrutura

- `app/` — app Expo (TypeScript), só interface. Rotas expo-router; chama a API em `app/src/api/` e `app/src/data/`; Supabase só para Auth. **Não calcula nota nem alertas.**
- `api/` — backend Node + Fastify + Prisma (Supabase Postgres). **Toda a regra de negócio** (nota, aditivos, alérgenos, barcode) vive em `api/src/domain/` (funções puras, Vitest). Rotas em `api/src/routes/`, schema em `api/prisma/`.
- `supabase/` — só configuração de Auth (`config.toml`). Não há Edge Functions.
- `pomo/` — logo do mascote (SVG/PNG).

## Comandos

No diretório `app/`:
```bash
npm test                       # Jest (preset jest-expo)
npx jest score                 # um arquivo de teste por nome
npx jest -t "nome do teste"    # um teste específico
npx tsc --noEmit               # typecheck
npx expo lint                  # lint
npx expo start --android       # dev server
```

No diretório `api/`:
```bash
npm test                # Vitest
npx vitest run score    # um arquivo
npm run typecheck       # tsc --noEmit
npm run dev             # Fastify com recarga (lê api/.env)
npx prisma migrate deploy  # aplica migrations pendentes no Supabase (exige DIRECT_URL)
npx prisma generate        # regenera o cliente após mudar o schema
```
`prisma migrate dev` **não funciona** aqui: o banco de sombra não tem o schema `auth` do Supabase (falha com `schema "auth" does not exist`). Escreva a migration à mão em `api/prisma/migrations/000N_nome/migration.sql` (inclua FK para `auth.users`, RLS e `REVOKE`, como em `0001_core` e `0002_favoritos`) e aplique com `migrate deploy`.
Sem Docker nesta máquina: dev e testes de banco usam um projeto Supabase na nuvem; segredos só em `api/.env` (ignorado pelo git). Sempre CLI, nunca MCP.

## Arquitetura e regras que cruzam arquivos

- **Nota base é determinística e sem IA** (`computeBaseScore`): mesmo produto → mesma nota; usa limites da lupa ANVISA (sólidos/líquidos diferentes). O perfil do usuário **nunca** altera a nota; a IA (futura) só explica.
- **Alertas de alergia são por regras** (tags do Open Food Facts + dicionário de ingredientes em PT + "contém/pode conter"), nunca só por IA. Dados ausentes geram aviso "dados incompletos", nunca "seguro". Produtos `source: 'user'` não verificados mostram aviso de dado de usuário.
- **Fluxo de produto**: app → API Fastify (`POST /v1/scans`) → banco próprio (`products`) → Open Food Facts → grava via Prisma. O app só tem a chave anônima do Supabase (Auth); as tabelas têm RLS deny-all e só a API acessa o banco, filtrando sempre por `user_id` do JWT.
- **Contas**: começam anônimas (Supabase anonymous auth). Dados de saúde (alergias, restrições, objetivos) só podem ser gravados com `health_consent_at` (LGPD, imposto por CHECK no banco). Exclusão de conta via `DELETE /v1/account` (Admin API do Supabase), com cascata.
- A API devolve `ProductAnalysis` (produto, nota, `scoreVersion`, aditivos, alertas) já pronto; os tipos do app são gerados do OpenAPI.
- Código de barras sempre passa por `normalizeBarcode` (UPC-A → EAN-13 com `0`, valida dígito verificador) antes de qualquer consulta. Em testes, use códigos com dígito verificador válido (senão a API responde 400).

### Funcionalidades de produto (regras em `api/src/domain/`, todas puras e testadas)

| Função | Domínio | Rota | Tela do app |
|---|---|---|---|
| Comparação de 2–3 produtos | `compare.ts` | `GET /v1/compare?barcodes=a,b,c` | `/comparar` (entra pelo Histórico ou pelo produto; `/search?pick=1` escolhe os produtos) |
| Alternativas personalizadas | `alternatives.ts` | `GET /v1/products/:barcode/alternatives` | seção "Alternativas melhores" em `/produto/[barcode]` (só para nota < 60) |
| Leitura de rótulo por foto | `labelReading.ts` + `integrations/gemini.ts` (`createGeminiVision`) | `POST /v1/labels` | `/rotulo` (botão "Fotografar o rótulo" quando o código não é encontrado) |
| Evolução alimentar | `stats.ts` | `GET /v1/stats?days=7..365` | `/evolucao` |
| Listas inteligentes | tabela `favorites` + `alternatives.ts` | `GET/PUT/DELETE /v1/favorites[/:barcode]` | `/listas`, botão "Salvar na lista" no produto |
| Pomo.ai explica a tela | `explainPrompt.ts` | `POST /v1/ai/explain` (`module`: produto, historico, evolucao, comparacao, alternativas, listas) | componente `ExplainCard` em cada tela |

Regras importantes dessas funcionalidades:
- **Alternativas**: só da mesma categoria, nota ≥ 5 pontos maior, com dados completos e **sem alérgeno `contem` do usuário** (os candidatos são analisados com o perfil do usuário na rota). Não há dado de **preço** no catálogo; o app avisa isso. Só sugere produtos que já estão no banco do Pomo (`products`), então a qualidade cresce com o uso.
- **Leitura de rótulo**: a IA só **extrai** valores (JSON, temperatura 0,1, `null` quando ilegível); a **nota continua sendo calculada por `computeBaseScore`**. O produto nasce `source: 'user'`, `verified: false` (o app mostra aviso), com código `user:<uuid>` quando não há código de barras. Valores por porção são convertidos para 100 g/ml no código (`labelToProduct`). Nunca sobrescreve produto já existente.
- **Evolução**: açúcar e sódio são **estimativa** (cada registro conta como 100 g/ml, `ESTIMATE_BASIS` em `stats.ts`); o app sempre diz isso.
- **IA e plano (Pomo+)**: `entitlements.ts` controla o acesso. Hoje `AI_OPEN_TO_ALL = true` (liberado para todos). Ao implementar a assinatura: coloque `AI_OPEN_TO_ALL = false`, faça `deps.planOf` (hoje padrão `'gratis'` em `routes/v1.ts`) consultar o plano real do usuário; a rota já responde `402 plan_required` e o `ExplainCard` já mostra a mensagem do Pomo+. A IA nunca altera nota nem alerta; só explica.

## Fluxo de trabalho

Desenvolvimento na branch `feat/fundacao`, executado tarefa a tarefa pelo processo superpowers (subagent-driven); o registro de progresso fica em `.superpowers/sdd/` (ignorado pelo git).

# Instruções de trabalho — Pomo AI

## Autonomia
- Trabalhe com autonomia e evite interromper o usuário.
- Não peça confirmação para decisões técnicas comuns.
- Quando houver dúvidas pequenas, escolha a solução mais adequada e continue.
- Faça escolhas seguindo boas práticas de engenharia.
- Só pergunte quando existir uma decisão crítica que altere significativamente o produto ou envolva risco irreversível.

## Execução
- Execute as tarefas do plano até a conclusão.
- Não pare entre tarefas para pedir autorização.
- Implemente, teste e revise cada tarefa antes de avançar.
- Corrija erros encontrados automaticamente.
- Não deixe funcionalidades simuladas ou incompletas.
- Preserve funcionalidades existentes.

## Subagentes
- Delegue tarefas quando isso melhorar a qualidade e velocidade.
- Oriente os subagentes a trabalharem sem interrupções desnecessárias.
- Revise os resultados antes de integrar.
- Não interrompa o fluxo por decisões que podem ser resolvidas tecnicamente.

## Segurança
- Nunca exponha credenciais ou dados sensíveis.
- Não execute exclusões irreversíveis sem autorização.
- Não faça commits ou pushes sem solicitação explícita.

## Estado atual (2026-11-14, fim do dia)

App chama-se **Pomo**; **Pomo.ai** é só o chat (Gemini).

**Feito:**
- Último commit enviado ao GitHub: `5b05248` (logout confiável com `signOut({ scope: 'local' })`, login com Google oculto pela flag `GOOGLE_LOGIN_ENABLED` em `SocialButtons.tsx`, confirmação de e-mail em `supabase/config.toml`). **As cinco funcionalidades de produto abaixo ainda NÃO foram commitadas.**
- API: domínio + rotas v1 (scans, produtos, busca e histórico devolvem `ProductAnalysis`, perfil, conta) + `POST /v1/chat` (Gemini via REST, modelo `GEMINI_MODEL`, padrão `gemini-3.5-flash-lite`; o prompt injeta perfil + produto). Migrations `0001_core` e `0002_favoritos` aplicadas no Supabase.
- **Comparação, alternativas, foto de rótulo, evolução, listas e "Pomo.ai explica"** (tabela acima): API com **99 testes** passando (`features.test.ts` no domínio, `v1-features.test.ts` nas rotas), `tsc` limpo nos dois projetos, 10 testes Jest no app. Testado ao vivo: Gemini leu uma foto de rótulo sintética (7 de 7 valores corretos, nota 32, alerta de glúten pelos ingredientes), a explicação por IA respondeu coerente, e os métodos Prisma de `favorites` rodaram no banco real (RLS ativo). O servidor sobe e as rotas novas exigem JWT (401 sem token). **As telas novas do app (`comparar`, `evolucao`, `listas`, `rotulo`, `ExplainCard`) só passaram em typecheck/lint, ainda não foram abertas num aparelho.** `api/.env` usa `PROJECT` (URL) e `GEMINI` (chave) como apelidos; `SUPABASE_SERVICE_ROLE_KEY` é opcional (sem ela, `DELETE /v1/account` responde 503).
- App: login, cadastro, esqueci a senha, redefinir senha (deep link `pomo://reset-password`), login social (Google; Apple só iOS) via Supabase PKCE, rota protegida com `Stack.Protected`; onboarding de 8 passos interativo; telas ligadas à API; chat Pomo.ai (`/chat`); busca (`/search`). `app/.env` tem `EXPO_PUBLIC_SUPABASE_*`; a URL da API sai do IP do Expo (porta 3333) ou `EXPO_PUBLIC_API_URL`.

**Armadilha:** no Git Bash o Vitest falha com `reading 'config'`; rode testes no PowerShell.

**Falta (depende do dono, no painel do Supabase):** ativar Google (Client ID/Secret do Google Cloud) e depois pôr `GOOGLE_LOGIN_ENABLED = true`; Apple se quiser; adicionar `pomo://**` em Auth → URL Configuration → Redirect URLs; ligar **"Confirm email"** no projeto remoto (o `config.toml` já diz `true`, mas a CLI não está ligada ao projeto: ligue pelo painel ou com `supabase link` + `supabase config push`); colocar `SUPABASE_SERVICE_ROLE_KEY` no `api/.env` para exclusão de conta. Login anônimo está desligado no projeto.

**Próximos passos:** testar as telas novas no aparelho (`npx expo start --android` + `npm run dev` em `api/`: fotografar um rótulo real, comparar dois produtos, salvar na lista, abrir a evolução); commitar as funcionalidades novas; T10 Dockerfile/deploy; assinatura Pomo+ (ver `entitlements.ts`); depois o plano de design. Para as alternativas funcionarem bem é preciso mais produtos no catálogo (hoje o banco tem 1); considerar popular `products` por categoria a partir do Open Food Facts.

**Como testar tudo:** `api/`: `npx tsc --noEmit` e `npx vitest run` (PowerShell); `app/`: `npx tsc --noEmit`, `npx jest` e `npx expo lint` (7 erros antigos de lint em `perfil.tsx`, `chat.tsx` e `data/hooks.ts`, não relacionados).

## Comunicação
- Informe brevemente o progresso.
- Só interrompa o usuário diante de bloqueios reais.
- Ao concluir, apresente tarefas realizadas, testes executados e pendências.