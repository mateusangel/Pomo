import type { ProductAnalysis, Profile } from './types.js';

const BASE = `Você é o Pomo.ai, o assistente de nutrição do app Pomo (Brasil). Fale sempre em português do Brasil, de forma curta, simpática e clara (no máximo ~120 palavras, sem enrolação).
Regras:
- A nota de 0 a 100 é calculada por regras fixas do app; você NUNCA a altera nem inventa outra. Você apenas explica.
- Alertas de alergia vêm das regras do app. Nunca diga que um produto é "seguro" para alérgicos; se faltar dado, diga que os dados estão incompletos e peça para conferir o rótulo.
- Não faça diagnóstico nem prescreva dieta ou tratamento. Para questões de saúde, recomende nutricionista ou médico.
- Responda só sobre alimentação, rótulos, ingredientes e hábitos. Para outros assuntos, redirecione com gentileza.
- Se não souber, diga que não sabe. Não invente números.`;

function profileLine(profile: Profile | null): string {
  if (!profile) return 'Perfil do usuário: não informado.';
  const parts = [
    profile.allergens.length ? `alergias: ${profile.allergens.join(', ')}` : '',
    profile.restrictions.length ? `restrições: ${profile.restrictions.join(', ')}` : '',
    profile.goals.length ? `objetivos: ${profile.goals.join(', ')}` : '',
    profile.lessSugar ? 'quer menos açúcar' : '',
    profile.lessSodium ? 'quer menos sódio' : '',
  ].filter(Boolean);
  return `Perfil do usuário: ${parts.length ? parts.join('; ') : 'sem preferências marcadas'}.`;
}

function productBlock(a: ProductAnalysis): string {
  const p = a.product;
  const score = a.score.status === 'ok' ? `${a.score.score}/100 (${a.score.band})` : 'sem dados suficientes';
  const n = p.nutrition;
  const nutri = [
    n.energyKcal != null && `${n.energyKcal} kcal`,
    n.sugarsG != null && `açúcares ${n.sugarsG} g`,
    n.addedSugarsG != null && `açúcar adicionado ${n.addedSugarsG} g`,
    n.saturatedFatG != null && `gordura saturada ${n.saturatedFatG} g`,
    n.sodiumMg != null && `sódio ${n.sodiumMg} mg`,
    n.fiberG != null && `fibras ${n.fiberG} g`,
    n.proteinG != null && `proteínas ${n.proteinG} g`,
  ]
    .filter(Boolean)
    .join(', ');
  const lines = [
    `Produto em foco: ${p.name}${p.brand ? ` (${p.brand})` : ''}.`,
    `Nota do app: ${score}. Valores por 100 ${p.isLiquid ? 'ml' : 'g'}: ${nutri || 'indisponíveis'}.`,
    p.ingredientsText ? `Ingredientes: ${p.ingredientsText}` : 'Ingredientes: indisponíveis.',
    a.additives.length ? `Aditivos: ${a.additives.map((x) => `${x.code} ${x.name}`).join('; ')}.` : '',
    a.alerts.alerts.length
      ? `Alertas ao usuário: ${a.alerts.alerts.map((x) => `${x.item} (${x.level})`).join('; ')}.`
      : '',
    !a.alerts.dataComplete ? 'Atenção: dados incompletos para avaliar alergias.' : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export function buildChatSystem(profile: Profile | null, analysis: ProductAnalysis | null): string {
  return [BASE, profileLine(profile), analysis ? productBlock(analysis) : ''].filter(Boolean).join('\n\n');
}
