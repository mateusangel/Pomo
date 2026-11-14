# Pomo AI — Documento de Design do Produto (MVP)

Data: 2026-11-14
Status: rascunho para aprovação

## 1. Intenção e porquê

O Pomo AI é um app comercial, lançado primeiro na Google Play Store no Brasil, para **pessoas que querem melhorar sua alimentação**.

Já existem apps que escaneiam e dão nota a alimentos (Desrotulando no Brasil, Yuka na Europa). O Pomo não quer ser mais um leitor de rótulo. Nas palavras do fundador:

> "O Pomo entende o objetivo de cada pessoa e transforma informações nutricionais em decisões práticas. Não quero apenas mostrar uma nota, mas explicar o impacto daquele alimento, oferecer alternativas melhores e permitir conversar com uma IA que considera seu perfil e seus objetivos. O diferencial é tornar a alimentação saudável mais simples, personalizada e acessível."

Ou seja, o valor está em três coisas:
1. Explicar o **impacto do alimento para o objetivo daquela pessoa**.
2. Sugerir uma **alternativa melhor e real**, que exista na prateleira brasileira.
3. Uma **conversa com a IA** que conhece o perfil e os objetivos da pessoa.

**Sucesso**: pessoas assinam o plano pago porque a parte personalizada as ajuda a decidir o que comprar e comer.

## 2. Objetivos, não-objetivos e anti-objetivos

### Objetivos (MVP)
- App Android publicado na Play Store, em português, para o Brasil.
- Scan e nota úteis e grátis, para atrair usuários pela loja.
- Camada personalizada paga (impacto, alternativas, chat, comparação) que justifique a assinatura.
- Mascote Pomo integrado à experiência.

### Não-objetivos (ficam para depois do lançamento)
- iOS (a stack escolhida permite publicar depois).
- Perfis de familiares / plano família.
- Recomendações proativas baseadas no histórico ("você tem escaneado muito sódio esta semana").
- Outros países e idiomas.

### Anti-objetivos (seria fracasso mesmo funcionando)
- **Um alerta de alergia errado ou ausente** quando a informação estava disponível. Segurança vem antes de tudo.
- **A nota mudar a cada scan** do mesmo produto. A nota base precisa ser estável e explicável.
- **Muitos scans terminando em "produto não encontrado"**, o que mata a retenção.
- **Alternativas genéricas** ("prefira um iogurte natural") em vez de produtos reais.
- **Aparência infantil** ou tom de julgamento/culpa.
- **Custo de IA crescendo mais rápido que a receita**.

## 3. Restrições

- **Plataforma**: Android primeiro; iOS não pode ficar bloqueado.
- **IA**: Gemini API (decisão do fundador).
- **Cobertura de dados**: o Open Food Facts (OFF) tem pouca cobertura de produtos brasileiros.
- **Licença ODbL do OFF**: melhorias feitas sobre os dados do OFF precisam ser compartilhadas de volta (por exemplo, enviando os produtos novos ao OFF).
- **LGPD**: alergias, restrições e objetivos de saúde são **dados pessoais sensíveis**. Exigem consentimento explícito, finalidade clara e opção de exclusão da conta e dos dados.
- **Saúde**: o app informa e orienta, mas não substitui um profissional. Isso precisa aparecer no app e nos termos. Alertas de alergia não podem depender só da IA.
- **Play Store**: assinaturas pelo Google Play Billing (o Google fica com 15%). Apps de saúde exigem a política de privacidade e a declaração de dados preenchidas.
- **Orçamento enxuto**: projeto em lançamento; os planos gratuitos dos serviços cobrem o início.
- **Equipe**: o fundador programa sozinho, com apoio do Claude. Não há designer nem nutricionista. O design system, as telas e o mascote saem do fundador com o Claude. Sem data de lançamento definida.
- **Sem nutricionista**: a fórmula da nota, o dicionário de alérgenos e aditivos e os prompts da IA seguem fontes públicas e citáveis (normas da ANVISA, Nutri-Score, avaliações de aditivos da EFSA/JECFA). Cada explicação de aditivo cita a fonte. *(Proposta do Claude)*: antes do lançamento, pagar uma revisão pontual de um nutricionista (algumas horas) sobre a fórmula e os textos de alergia, para reduzir o risco de responsabilidade.

## 4. Abordagens consideradas

| Abordagem | Prós | Contras | Decisão |
|---|---|---|---|
| **A. React Native (Expo) + Supabase** | Postgres deixa simples a consulta central das alternativas ("mesma categoria, nota melhor, vendido no Brasil") e a busca por nome; Expo/EAS facilita publicar no iOS depois; Edge Functions protegem a chave do Gemini e controlam limites | Integração com o Gemini é feita à mão (simples) | **Escolhida pelo fundador**, porque as alternativas, o diferencial pago, dependem de consultas relacionais |
| B. Flutter + Firebase | Integração nativa com o Gemini; Flutter é ótimo para animação | O Firestore é fraco para busca textual e consultas relacionais; precisaria de um serviço extra de busca; as alternativas, que são o diferencial, ficariam mais difíceis | Descartada |
| C. Kotlin nativo | Desempenho máximo no Android | Travaria o iOS mais tarde | Descartada |

## 5. Funcionalidades do MVP

### 5.1 Grátis
- **Scanner de código de barras** (EAN-13/EAN-8) e **busca por nome**.
- **Nota base 0–100** e classificação: excelente, bom, regular, ruim.
- **Alertas** de excesso de açúcar adicionado, sódio e gordura saturada (critérios da lupa da ANVISA, RDC 429/2020 e IN 75/2020).
- **Aditivos e adoçantes** identificados, cada um com uma explicação curta.
- **Pontos positivos e negativos** do produto, em linguagem simples.
- **Perfil alimentar**: objetivo(s), alergias e intolerâncias, restrições (vegetariano, vegano etc.), preferência por menos açúcar ou sódio.
- **Alertas de alergia e restrição em destaque** na tela do produto.
- **Histórico** de produtos escaneados.
- **Foto do rótulo quando o produto não é encontrado**: o Gemini (visão) extrai nome, tabela nutricional e ingredientes; a pessoa confirma; o produto entra no banco próprio.

### 5.2 Pago (assinatura "Pomo+", R$ 19,90/mês)
Preço mensal definido pelo fundador. Plano anual *(proposta do Claude)*: R$ 149,90/ano (cerca de 37% de desconto), para reduzir cancelamentos.

- **Leitura personalizada do impacto** do produto para o objetivo da pessoa.
- **Alternativas melhores**: produtos reais da mesma categoria, com nota melhor e compatíveis com o perfil.
- **Chat com o Pomo**, ciente do perfil, dos objetivos e do produto em contexto.
- **Comparação entre produtos** (dois ou mais lado a lado, com recomendação para o perfil).
- **Degustação no plano grátis** *(decisão do Claude)*: 3 mensagens de chat por dia; da leitura personalizada, só a primeira frase, com o resto bloqueado; das alternativas, só a melhor, com as outras bloqueadas.
- **Limite da foto de rótulo no plano grátis** *(decisão do Claude)*: 5 por dia, por usar o Gemini com visão. É generoso, porque a foto aumenta a base para todos.

### 5.3 Onboarding
O perfil vem **antes do primeiro scan**: objetivo, alergias e restrições em poucos toques, com consentimento LGPD explícito para os dados de saúde. Sem o perfil, o Pomo é só mais um leitor de rótulo. A pessoa pode pular e preencher depois, mas o app incentiva o preenchimento.

**Conta** *(decisão do Claude)*: o app começa com uma **conta anônima** (Supabase anonymous auth), então dá para fazer o perfil e escanear sem cadastro. Login com Google (e e-mail como alternativa) é pedido ao assinar o Pomo+ ou para salvar o histórico entre aparelhos. A conta anônima é convertida, sem perder dados. O ID do usuário no Supabase é o mesmo usado no RevenueCat.

## 6. Decisões de produto e técnicas

### 6.1 Nota em duas camadas
- **Nota base (determinística)**: calculada por regras fixas, sem IA, a partir da tabela nutricional, da lupa da ANVISA, do Nutri-Score (adaptado) e de penalidades por aditivos. O mesmo produto sempre tem a mesma nota, e o app consegue explicar como ela foi calculada.
- **Leitura personalizada (IA, paga)**: por cima da nota base, o Gemini explica o que aquele produto significa para o objetivo da pessoa. A IA **não altera** a nota base.

### 6.2 Alergias e restrições
- A detecção de alérgenos é feita **por regras**, a partir dos campos de alérgenos do OFF, da declaração obrigatória de alergênicos do rótulo brasileiro (RDC 727/2022) e de um dicionário de ingredientes, e não apenas pela IA.
- A IA pode complementar ("este ingrediente pode conter traços de..."), mas um alerta nunca depende só dela.
- Quando os dados estão incompletos, o app diz isso claramente em vez de mostrar "seguro".

### 6.3 Dados de produtos
- **Fonte primária**: API do Open Food Facts.
- **Banco próprio no Supabase (Postgres)**: cache dos produtos consultados e produtos criados por foto do rótulo.
- **Crescimento da base**: cada foto de rótulo confirmada vira um produto no banco; por conformidade com a ODbL, as contribuições são enviadas de volta ao OFF.
- **Alternativas**: consulta no banco por mesma categoria, nota base maior e compatibilidade com o perfil (alergias e restrições); o Gemini escolhe e explica entre os candidatos. A IA **nunca inventa** produtos.
- **Carga inicial antes do lançamento** *(decisão do Claude)*: importação em massa dos produtos brasileiros do dump público do OFF, com nota base pré-calculada e categorias normalizadas. Sem isso, as alternativas não teriam candidatos no primeiro dia. Uma revisão da cobertura nas categorias mais escaneadas (iogurtes, biscoitos, cereais, bebidas, snacks) faz parte da preparação do lançamento.
- **Produtos enviados por usuários** *(decisão do Claude)*: um produto criado por foto fica com status **"não verificado"**. Ele já aparece para todos, mas os alertas de alergia vêm com o aviso "dados enviados por usuário, confira o rótulo". O produto passa a **"verificado"** quando uma segunda pessoa confirma dados iguais ou quando um administrador o aprova numa fila simples de revisão. Só produtos verificados são enviados ao OFF e entram como alternativas.

### 6.4 IA (Gemini)
- Chamado **somente pelo backend** (Supabase Edge Functions); a chave nunca fica no app.
- O backend aplica os limites do plano grátis e registra o uso por usuário, para acompanhar o custo.
- Modelo: família Gemini Flash para as tarefas do dia a dia (custo baixo); o modelo exato fica a cargo de quem constrói.
- Respostas sobre o mesmo produto e o mesmo perfil podem ser cacheadas para reduzir o custo.

### 6.5 Stack
- **App**: React Native com Expo (EAS Build e Submit).
- **Backend**: Supabase (Postgres, Auth, Storage para fotos de rótulo, Edge Functions).
- **Assinaturas**: RevenueCat sobre o Google Play Billing.
- **Mascote** *(decisão do Claude)*: **SVG animado em código** (react-native-svg + react-native-reanimated), e não Rive. O Rive precisa de um animador trabalhando no editor dele, e o projeto não tem designer. O SVG em código pode ser criado e ajustado direto no projeto e atende o pedido original de animações em SVG. Uma máquina de estados simples em código controla piscar, olhos e expressões.

### 6.6 Mascote Pomo
- Maçã inteligente, amigável, moderna, nada infantil.
- Estados mínimos do MVP: ocioso (piscando, olhando ao redor), pensando (durante a análise), reações à classificação (excelente, bom, regular, ruim), alerta (alergia ou restrição) e conversando (no chat).
- Tom: acolhedor, direto, sem julgamento. O Pomo orienta, não dá bronca.
- O visual e o design system são a próxima etapa, depois deste documento.

## 7. Riscos e custos

### Riscos
| Risco | Mitigação |
|---|---|
| Baixa cobertura do OFF no Brasil | Foto do rótulo + banco próprio que cresce com o uso |
| Alerta de alergia errado | Detecção por regras, aviso de dados incompletos, termos claros |
| Leitura errada do rótulo pela IA | Pessoa confirma os dados extraídos antes de salvar |
| Concorrência gratuita (Desrotulando, Yuka) | Diferencial pago na personalização, não no scan |
| Custo de IA | Gemini Flash, limites no plano grátis, cache de respostas |
| LGPD e dados de saúde | Consentimento explícito, minimização, exclusão de conta |
| Políticas de apps de saúde da Play Store | Política de privacidade, aviso de "não substitui profissional" |
| Licença ODbL | Envio das contribuições de volta ao OFF |

### Custos iniciais estimados
- Conta de desenvolvedor Google Play: US$ 25 (uma vez).
- Supabase: plano gratuito no início; plano Pro a partir de cerca de US$ 25/mês quando crescer.
- RevenueCat: gratuito até um faturamento mensal relevante.
- Gemini Flash: frações de centavo por análise; o maior custo variável, que acompanha o uso pago.
- Expo EAS: plano gratuito cobre o início.
- Google Play: 15% das assinaturas.

## 8. O que fica a cargo de quem constrói
- Fórmula exata da nota base (pesos do Nutri-Score adaptado, penalidades por aditivo), desde que determinística e explicável.
- Esquema do banco, estrutura das Edge Functions e dos prompts.
- Modelo Gemini específico dentro da família Flash.
- Biblioteca de leitura de código de barras (por exemplo, expo-camera).
- Estratégia de cache.
- Fluxo técnico de envio das contribuições ao OFF.

## 9. Próximas etapas
1. Aprovar este documento.
2. Design System e identidade visual do Pomo.
3. Design das telas.
4. Plano de implementação e desenvolvimento.
