import type { Comparison } from './compare.js';
import type { StatsSummary } from './stats.js';
import type { ProductAnalysis, Profile } from './types.js';

/** Telas onde o usuário pode pedir uma explicação ao Pomo.ai. */
export const EXPLAIN_MODULES = ['produto', 'historico', 'evolucao', 'comparacao', 'alternativas', 'listas'] as const;
export type ExplainModule = (typeof EXPLAIN_MODULES)[number];

const RULES = `Você é o Pomo.ai, assistente de alimentação do app Pomo (Brasil). Responda em português do Brasil, em até 120 palavras, de forma clara e simpática.
Regras:
- Use APENAS os dados fornecidos. Não invente produtos, números ou tendências.
- As notas (0 a 100) são fixas e calculadas pelo app. Você explica, nunca altera.
- Não diga que um produto é "seguro" para alérgicos; em dúvida, peça para conferir o rótulo.
- Não faça diagnóstico nem prescreva dieta. Para saúde, recomende nutricionista ou médico.
- Estimativas de consumo são aproximadas: diga isso quando citá-las.`;

const TASK: Record<ExplainModule, string> = {
  produto: 'Explique o que está acontecendo com este produto: a nota, os pontos de atenção e o que o usuário pode observar.',
  historico: 'Interprete os produtos registrados recentemente: padrões de escolha e o que chama atenção.',
  evolucao: 'Interprete as estatísticas do período: tendência da nota, açúcar e sódio estimados e um ponto de atenção.',
  comparacao: 'Explique a comparação entre os produtos e por que a recomendação faz sentido para o perfil do usuário.',
  alternativas: 'Explique por que as alternativas sugeridas são melhores que o produto atual e o que o usuário ganha ao trocar.',
  listas: 'Interprete a lista de compras: quais itens merecem troca e o que mudaria se o usuário fizesse as substituições.',
};

function profileLine(profile: Profile | null): string {
  if (!profile) return 'Perfil: não informado.';
  const parts = [
    profile.allergens.length ? `alergias: ${profile.allergens.join(', ')}` : '',
    profile.restrictions.length ? `restrições: ${profile.restrictions.join(', ')}` : '',
    profile.lessSugar ? 'quer menos açúcar' : '',
    profile.lessSodium ? 'quer menos sódio' : '',
  ].filter(Boolean);
  return `Perfil: ${parts.length ? parts.join('; ') : 'sem preferências marcadas'}.`;
}

function productLine(a: ProductAnalysis): string {
  const s = a.score.status === 'ok' ? `${a.score.score}/100 (${a.score.band})` : 'sem dados suficientes';
  const n = a.product.nutrition;
  const nutri = [
    n.sugarsG !== undefined && `açúcares ${n.sugarsG} g`,
    n.addedSugarsG !== undefined && `açúcar adicionado ${n.addedSugarsG} g`,
    n.sodiumMg !== undefined && `sódio ${n.sodiumMg} mg`,
    n.saturatedFatG !== undefined && `gordura saturada ${n.saturatedFatG} g`,
  ]
    .filter(Boolean)
    .join(', ');
  const unit = a.product.isLiquid ? 'ml' : 'g';
  return `- ${a.product.name}${a.product.brand ? ` (${a.product.brand})` : ''}: nota ${s}; por 100 ${unit}: ${nutri || 'dados indisponíveis'}`;
}

export interface ExplainContext {
  module: ExplainModule;
  profile: Profile | null;
  product?: ProductAnalysis;
  products?: ProductAnalysis[];
  comparison?: Comparison;
  stats?: StatsSummary;
}

/** Monta o prompt do módulo, só com os dados que a tela mostra. */
export function buildExplainPrompt(ctx: ExplainContext): { system: string; prompt: string } {
  const sections: string[] = [profileLine(ctx.profile)];

  if (ctx.product) sections.push(`Produto em foco:\n${productLine(ctx.product)}`);
  if (ctx.products?.length) sections.push(`Produtos:\n${ctx.products.map(productLine).join('\n')}`);
  if (ctx.comparison) {
    const rec = ctx.comparison.recommendation;
    const recText = rec ? `${rec.barcode} — ${rec.reason}` : 'sem recomendação';
    sections.push(`Recomendação do app: ${recText}.${ctx.comparison.notice ? ` Aviso: ${ctx.comparison.notice}` : ''}`);
  }
  if (ctx.stats) {
    const s = ctx.stats;
    const trend = s.trendDelta !== null ? `${s.trend} (${s.trendDelta > 0 ? '+' : ''}${s.trendDelta})` : s.trend;
    sections.push(
      `Período de ${s.days} dias: ${s.totalScans} registros, ${s.uniqueProducts} produtos diferentes, nota média ${s.averageScore ?? 'sem dados'}. ` +
        `Ruins: ${s.bandCounts.ruim}; regulares: ${s.bandCounts.regular}; bons ou excelentes: ${s.bandCounts.bom + s.bandCounts.excelente}. ` +
        `Açúcar estimado: ${s.estimatedSugarG} g; sódio estimado: ${s.estimatedSodiumMg} mg (estimativa: 100 g/ml por registro). ` +
        `Tendência da nota: ${trend}.`,
    );
  }

  return {
    system: `${RULES}\n\nTarefa: ${TASK[ctx.module]}\n\n${sections.join('\n\n')}`,
    prompt: 'Me explique o que está acontecendo.',
  };
}
