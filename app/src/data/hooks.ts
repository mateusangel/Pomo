import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

export interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
}

/** Executa `fn` ao montar e quando `deps` mudam; ignora respostas de execuções antigas. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: ApiError | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const run = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const load = useCallback(() => {
    const id = ++run.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef.current().then(
      (data) => id === run.current && setState({ data, error: null, loading: false }),
      (e: unknown) =>
        id === run.current &&
        setState({ data: null, error: e instanceof ApiError ? e : new ApiError(0, 'unknown'), loading: false }),
    );
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, deps);

  return { ...state, reload: load };
}

/** Texto amigável para erros da API. */
export function apiErrorText(e: ApiError | null): string {
  if (!e) return '';
  if (e.status === 0) return 'Sem conexão com o servidor do Pomo. Verifique se a API está ligada e sua internet.';
  if (e.status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (e.status === 502 || e.status === 503) return 'Não conseguimos consultar a base agora. Tente de novo em instantes.';
  if (e.status === 404) return 'Esta função ainda não está disponível no servidor. Tente de novo mais tarde ou atualize o app.';
  return 'Algo deu errado. Tente novamente.';
}
