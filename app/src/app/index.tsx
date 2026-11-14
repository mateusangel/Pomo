import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { Pomo } from '../components/Pomo';
import { useAsync } from '../data/hooks';
import { colors } from '../theme';

/** Porta de entrada: sem sessão → login; sem perfil salvo → onboarding; senão → app. */
export default function Index() {
  const { session, loading } = useAuth();
  const uid = session?.user.id;
  const profile = useAsync(() => (uid ? api.getProfile() : Promise.resolve(null)), [uid]);

  if (loading) return <Splash />;
  if (!session) return <Redirect href="/login" />;
  if (profile.loading) return <Splash />;
  // Se a API estiver fora do ar, segue para o app; as telas mostram o erro com opção de tentar de novo.
  if (profile.error) return <Redirect href="/(tabs)" />;
  if (!profile.data?.profile) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' }}>
      <Pomo size={160} mood="feliz" />
    </View>
  );
}
