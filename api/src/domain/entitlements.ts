/**
 * Quais recursos de IA (Pomo.ai explicando telas) cada plano tem acesso.
 *
 * HOJE: liberado para todos. Quando a assinatura Pomo+ for implementada,
 * troque AI_OPEN_TO_ALL por false: só o plano 'plus' passa a ter acesso.
 */
export const AI_OPEN_TO_ALL = true;

export type Plan = 'gratis' | 'plus';

export function hasAiAccess(plan: Plan): boolean {
  if (AI_OPEN_TO_ALL) return true;
  return plan === 'plus';
}
