import { BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { usePendingProfileSync } from '../auth/usePendingProfileSync';
import { BrandSplash } from '../components/BrandSplash';
import { OnboardingProvider, useOnboarding } from '../onboarding/OnboardingProvider';
import { colors } from '../theme';

// A splash nativa (logo do Pomo, configurada no app.json) fica na tela até o app saber para onde ir.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });

/** Tempo mínimo da splash da marca logo depois de entrar, para não piscar. */
const POST_LOGIN_SPLASH_MS = 1000;
/** Segurança: se algo travar, a splash nativa sai mesmo assim. */
const FAILSAFE_MS = 8000;

function Routes() {
  const { session, user, loading } = useAuth();
  const { seen } = useOnboarding();
  const uid = session?.user.id;
  const signedIn = !!session;
  const hasName = typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.length > 0;
  const synced = usePendingProfileSync(uid, hasName);

  const ready = !loading && seen !== null && synced;
  const [nativeHidden, setNativeHidden] = useState(false);
  const bootUid = useRef<string | undefined>(undefined);
  const [post, setPost] = useState({ active: false, minDone: false });

  // Libera a splash nativa só quando já dá para mostrar a tela certa (sem segunda splash em seguida).
  useEffect(() => {
    if (nativeHidden || !ready) return;
    bootUid.current = uid;
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setNativeHidden(true);
    }, 60);
    return () => clearTimeout(t);
  }, [ready, nativeHidden, uid]);

  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), FAILSAFE_MS);
    return () => clearTimeout(t);
  }, []);

  // Login feito com o app já aberto: splash da marca até a tela principal. Sessão restaurada na abertura não conta.
  useEffect(() => {
    if (!nativeHidden) return;
    // Estado sincronizado com a sessão (sistema externo): setState no efeito é intencional aqui.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!uid) {
      bootUid.current = undefined;
      setPost({ active: false, minDone: false });
      return;
    }
    if (bootUid.current === uid) return;
    setPost({ active: true, minDone: false });
    /* eslint-enable react-hooks/set-state-in-effect */
    const t = setTimeout(() => setPost((p) => ({ ...p, minDone: true })), POST_LOGIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, [uid, nativeHidden]);

  const showSplash = post.active && !(post.minDone && synced);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        {/* index decide para onde ir; reset-password e auth-callback funcionam com ou sem sessão. */}
        <Stack.Screen name="index" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="auth-callback" />

        {/* Sem sessão: onboarding (uma vez) e depois a autenticação. */}
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack.Protected>

        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="produto/[barcode]" />
          <Stack.Screen name="search" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="chat" options={{ animation: 'slide_from_bottom' }} />
        </Stack.Protected>
      </Stack>
      {showSplash && <BrandSplash />}
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold,
  });
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <OnboardingProvider>
          <Routes />
        </OnboardingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
