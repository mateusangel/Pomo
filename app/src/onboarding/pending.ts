import type { AllergenId, ProfileData, RestrictionId } from '../api/types';

/** Respostas do onboarding guardadas no aparelho até o usuário criar a conta ou entrar. */
export interface PendingOnboarding {
  name: string;
  profile: ProfileData;
  consent: boolean;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** Lê o JSON salvo; devolve null se estiver ausente ou corrompido. */
export function parsePending(raw: string | null): PendingOnboarding | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { name?: unknown; consent?: unknown; profile?: Record<string, unknown> | null };
    const p = v.profile;
    if (!p || typeof p !== 'object') return null;
    return {
      name: typeof v.name === 'string' ? v.name : '',
      consent: v.consent === true,
      profile: {
        goals: strings(p.goals),
        allergens: strings(p.allergens) as AllergenId[],
        restrictions: strings(p.restrictions) as RestrictionId[],
        lessSugar: p.lessSugar === true,
        lessSodium: p.lessSodium === true,
      },
    };
  } catch {
    return null;
  }
}
