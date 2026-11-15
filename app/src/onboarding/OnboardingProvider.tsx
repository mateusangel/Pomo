import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { readOnboardingSeen, writeOnboardingSeen } from './storage';

interface OnboardingContextValue {
  /** null enquanto a leitura do aparelho não terminou. */
  seen: boolean | null;
  /** Marca o onboarding como visto (ele só aparece uma vez por aparelho). */
  markSeen: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    readOnboardingSeen().then(setSeen);
  }, []);

  const markSeen = useCallback(async () => {
    setSeen(true);
    await writeOnboardingSeen();
  }, []);

  const value = useMemo(() => ({ seen, markSeen }), [seen, markSeen]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding fora do OnboardingProvider');
  return ctx;
}
