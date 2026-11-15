import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { fragmentParams } from './urlParams';

WebBrowser.maybeCompleteAuthSession();

export type SocialProvider = 'google' | 'apple';

type Result = { ok: true } | { ok: false; message: string };

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** true enquanto a sessão salva ainda está sendo lida. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<Result>;
  /** `confirmEmail: true` quando o projeto exige confirmar o e-mail antes de entrar. */
  signUp: (name: string, email: string, password: string) => Promise<Result & { confirmEmail?: boolean }>;
  sendPasswordReset: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
  signInWithProvider: (provider: SocialProvider) => Promise<Result & { cancelled?: boolean }>;
  /** Troca o `code` do link de recuperação por uma sessão. */
  exchangeCode: (code: string) => Promise<Result>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Traduz os erros do Supabase Auth para português. */
export function authMessage(error: { message?: string; code?: string; status?: number } | null | undefined): string {
  const code = error?.code ?? '';
  const msg = (error?.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (code === 'email_not_confirmed' || msg.includes('not confirmed')) return 'Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada.';
  if (code === 'user_already_exists' || msg.includes('already registered')) return 'Já existe uma conta com este e-mail. Tente entrar.';
  if (code === 'weak_password' || msg.includes('password should')) return 'Senha fraca. Use ao menos 8 caracteres, com letras e números.';
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || error?.status === 429)
    return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (code === 'same_password') return 'Escolha uma senha diferente da atual.';
  if (code === 'provider_disabled' || msg.includes('provider is not enabled')) return 'Este login social ainda não está ativado.';
  if (msg.includes('network') || msg.includes('fetch')) return 'Sem conexão. Verifique sua internet.';
  return 'Algo deu errado. Tente novamente.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback<AuthContextValue['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { ok: false, message: authMessage(error) } : { ok: true };
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() }, emailRedirectTo: Linking.createURL('/') },
    });
    if (error) return { ok: false, message: authMessage(error) };
    // Sem sessão = o projeto exige confirmação de e-mail.
    // Com e-mail já cadastrado, o Supabase devolve usuário sem identidades (para não revelar a conta).
    if (data.user && (data.user.identities?.length ?? 1) === 0)
      return { ok: false, message: authMessage({ code: 'user_already_exists' }) };
    return { ok: true, confirmEmail: !data.session };
  }, []);

  const sendPasswordReset = useCallback<AuthContextValue['sendPasswordReset']>(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: Linking.createURL('reset-password'),
    });
    return error ? { ok: false, message: authMessage(error) } : { ok: true };
  }, []);

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? { ok: false, message: authMessage(error) } : { ok: true };
  }, []);

  const exchangeCode = useCallback<AuthContextValue['exchangeCode']>(async (code) => {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? { ok: false, message: 'Link inválido ou expirado. Peça um novo.' } : { ok: true };
  }, []);

  const signInWithProvider = useCallback<AuthContextValue['signInWithProvider']>(async (provider) => {
    const redirectTo = Linking.createURL('auth-callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) return { ok: false, message: authMessage(error) };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return { ok: false, cancelled: true, message: '' };

    // PKCE devolve `code` na query; em erros o Supabase pode usar a query ou o fragmento (#).
    const params = { ...Linking.parse(result.url).queryParams, ...fragmentParams(result.url) };
    const code = typeof params.code === 'string' ? params.code : null;
    if (!code) {
      const desc = params.error_description;
      return { ok: false, message: authMessage({ message: typeof desc === 'string' ? desc : '' }) };
    }
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    return exchangeError ? { ok: false, message: authMessage(exchangeError) } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    // Escopo local: a sessão do aparelho é limpa sempre, mesmo sem rede ou com o servidor fora.
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      setSession(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      sendPasswordReset,
      updatePassword,
      signInWithProvider,
      exchangeCode,
      signOut,
    }),
    [session, loading, signIn, signUp, sendPasswordReset, updatePassword, signInWithProvider, exchangeCode, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
}
