import AsyncStorage from '@react-native-async-storage/async-storage';
import { parsePending, type PendingOnboarding } from './pending';

const SEEN_KEY = 'pomo.onboarding.seen.v1';
const PENDING_KEY = 'pomo.onboarding.pending.v1';

/** Falhas de armazenamento nunca derrubam o app: no pior caso o onboarding aparece de novo. */
export async function readOnboardingSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SEEN_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function writeOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, '1');
  } catch {
    // sem armazenamento: o onboarding pode reaparecer na próxima abertura.
  }
}

export async function savePending(value: PendingOnboarding): Promise<void> {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(value));
  } catch {
    // o perfil ainda pode ser preenchido depois, na aba Perfil.
  }
}

export async function loadPending(): Promise<PendingOnboarding | null> {
  try {
    return parsePending(await AsyncStorage.getItem(PENDING_KEY));
  } catch {
    return null;
  }
}

export async function clearPending(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
  } catch {
    // ignora
  }
}
