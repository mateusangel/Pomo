import { useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../api/client';
import { supabase } from '../lib/supabase';
import { clearPending, loadPending } from '../onboarding/storage';

/** Espera máxima antes de seguir para o app (o servidor pode estar acordando). */
const MAX_WAIT_MS = 4000;

/**
 * Envia para a API as respostas do onboarding feitas antes do login.
 * Nunca sobrescreve um perfil que já exista no servidor. Se a rede falhar, mantém os dados
 * no aparelho e tenta de novo na próxima abertura.
 */
async function syncPending(hasName: boolean): Promise<void> {
  const pending = await loadPending();
  if (!pending) return;
  try {
    const server = await api.getProfile();
    if (!server.profile) await api.putProfile(pending.profile, pending.consent);
  } catch (e) {
    const rejected =
      e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status);
    if (rejected) await clearPending(); // reenviar não adianta
    return;
  }
  if (pending.name && !hasName) await supabase.auth.updateUser({ data: { name: pending.name } }).catch(() => {});
  await clearPending();
}

/** true quando não há sessão ou a sincronização do perfil do onboarding terminou (ou estourou o prazo). */
export function usePendingProfileSync(uid: string | undefined, hasName: boolean): boolean {
  const [doneUid, setDoneUid] = useState<string | null>(null);
  const hasNameRef = useRef(hasName);

  // Declarado antes do efeito de sincronização, então já está atualizado quando ele roda.
  useEffect(() => {
    hasNameRef.current = hasName;
  }, [hasName]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, MAX_WAIT_MS);
    });
    Promise.race([syncPending(hasNameRef.current).catch(() => {}), timeout]).then(() => {
      if (!cancelled) setDoneUid(uid);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [uid]);

  return !uid || doneUid === uid;
}
