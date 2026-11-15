import { Redirect } from 'expo-router';
import { useAuth } from '../auth/AuthProvider';
import { useOnboarding } from '../onboarding/OnboardingProvider';

/**
 * Porta de entrada: com sessão → app; sem sessão → onboarding (só na primeira vez) e depois login.
 * Enquanto lê sessão e flag do aparelho não renderiza nada: a splash nativa continua na tela.
 */
export default function Index() {
  const { session, loading } = useAuth();
  const { seen } = useOnboarding();

  if (loading || seen === null) return null;
  if (session) return <Redirect href="/(tabs)" />;
  return <Redirect href={seen ? '/login' : '/onboarding'} />;
}
