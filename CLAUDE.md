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
npx prisma migrate dev  # migrations (exige DIRECT_URL do Supabase)
```
Sem Docker nesta máquina: dev e testes de banco usam um projeto Supabase na nuvem; segredos só em `api/.env` (ignorado pelo git). Sempre CLI, nunca MCP.

## Arquitetura e regras que cruzam arquivos

- **Nota base é determinística e sem IA** (`computeBaseScore`): mesmo produto → mesma nota; usa limites da lupa ANVISA (sólidos/líquidos diferentes). O perfil do usuário **nunca** altera a nota; a IA (futura) só explica.
- **Alertas de alergia são por regras** (tags do Open Food Facts + dicionário de ingredientes em PT + "contém/pode conter"), nunca só por IA. Dados ausentes geram aviso "dados incompletos", nunca "seguro". Produtos `source: 'user'` não verificados mostram aviso de dado de usuário.
- **Fluxo de produto**: app → API Fastify (`POST /v1/scans`) → banco próprio (`products`) → Open Food Facts → grava via Prisma. O app só tem a chave anônima do Supabase (Auth); as tabelas têm RLS deny-all e só a API acessa o banco, filtrando sempre por `user_id` do JWT.
- **Contas**: começam anônimas (Supabase anonymous auth). Dados de saúde (alergias, restrições, objetivos) só podem ser gravados com `health_consent_at` (LGPD, imposto por CHECK no banco). Exclusão de conta via `DELETE /v1/account` (Admin API do Supabase), com cascata.
- A API devolve `ProductAnalysis` (produto, nota, `scoreVersion`, aditivos, alertas) já pronto; os tipos do app são gerados do OpenAPI.
- Código de barras sempre passa por `normalizeBarcode` (UPC-A → EAN-13 com `0`, valida dígito verificador) antes de qualquer consulta.

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

**Feito (sem commits):**
- API: domínio + rotas v1 (scans, produtos, busca e histórico devolvem `ProductAnalysis`, perfil, conta) + `POST /v1/chat` (Gemini via REST, modelo `GEMINI_MODEL`, padrão `gemini-3.5-flash-lite`; o prompt injeta perfil + produto). 67 testes passam. Migration `0001_core` aplicada no Supabase. `api/.env` usa `PROJECT` (URL) e `GEMINI` (chave) como apelidos; `SUPABASE_SERVICE_ROLE_KEY` é opcional (sem ela, `DELETE /v1/account` responde 503).
- App: login, cadastro, esqueci a senha, redefinir senha (deep link `pomo://reset-password`), login social (Google; Apple só iOS) via Supabase PKCE, rota protegida com `Stack.Protected`; onboarding de 8 passos interativo; telas ligadas à API; chat Pomo.ai (`/chat`); busca (`/search`). `app/.env` tem `EXPO_PUBLIC_SUPABASE_*`; a URL da API sai do IP do Expo (porta 3333) ou `EXPO_PUBLIC_API_URL`.

**Armadilha:** no Git Bash o Vitest falha com `reading 'config'`; rode testes no PowerShell.

**Falta (depende do dono, no painel do Supabase):** ativar Google (Client ID/Secret do Google Cloud) e, se quiser, Apple; adicionar `pomo://**` em Auth → URL Configuration → Redirect URLs; decidir sobre "Confirm email" (hoje exigido); colocar `SUPABASE_SERVICE_ROLE_KEY` no `api/.env` para exclusão de conta. Login anônimo está desligado no projeto.

**Próximos passos:** testar no aparelho (`npx expo start --android` + `npm run dev` em `api/`), T10 Dockerfile/deploy, depois o plano de design.

## Comunicação
- Informe brevemente o progresso.
- Só interrompa o usuário diante de bloqueios reais.
- Ao concluir, apresente tarefas realizadas, testes executados e pendências.