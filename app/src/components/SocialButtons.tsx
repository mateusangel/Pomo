import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth, type SocialProvider } from '../auth/AuthProvider';
import { colors, fonts, radius } from '../theme';

function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <Path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <Path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </Svg>
  );
}

function AppleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#fff"
        d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.700 2.400 2.900 2.300 1.200 0 1.600-.7 3-.7s1.800.7 3 .7c1.300 0 2.100-1.100 2.800-2.300.9-1.300 1.200-2.500 1.300-2.600-.1 0-2.500-1-2.500-3.700zM14.200 5.800c.6-.8 1.100-1.900.9-3-.9 0-2.100.6-2.700 1.400-.6.700-1.100 1.800-1 2.900 1.100.1 2.100-.5 2.800-1.300z"
      />
    </Svg>
  );
}

/** Login com Google oculto por enquanto (o provedor ainda não está configurado). Mude para true para reexibir. */
const GOOGLE_LOGIN_ENABLED = false;

/** Há algum login social visível neste aparelho? Quem mostra o divisor "ou" consulta isto. */
export const HAS_SOCIAL_LOGIN = GOOGLE_LOGIN_ENABLED || Platform.OS === 'ios';

/** Login social (Google, e Apple no iOS). `onError` recebe a mensagem já em português. */
export function SocialButtons({ onError }: { onError: (message: string | null) => void }) {
  const { signInWithProvider } = useAuth();
  const [busy, setBusy] = useState<SocialProvider | null>(null);

  const go = async (provider: SocialProvider) => {
    if (busy) return;
    onError(null);
    setBusy(provider);
    const result = await signInWithProvider(provider);
    setBusy(null);
    if (!result.ok && !result.cancelled) onError(result.message);
    // Sucesso: o AuthProvider atualiza a sessão e o roteador leva para dentro do app.
  };

  if (!HAS_SOCIAL_LOGIN) return null;

  return (
    <View style={s.col}>
      {GOOGLE_LOGIN_ENABLED && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continuar com Google"
          disabled={!!busy}
          onPress={() => go('google')}
          style={({ pressed }) => [s.btn, s.google, pressed && { opacity: 0.85 }]}
        >
          {busy === 'google' ? <ActivityIndicator color={colors.ink} /> : <GoogleG />}
          <Text maxFontSizeMultiplier={1.3} style={[s.text, { color: colors.ink }]}>Continuar com Google</Text>
        </Pressable>
      )}

      {Platform.OS === 'ios' && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Continuar com Apple"
          disabled={!!busy}
          onPress={() => go('apple')}
          style={({ pressed }) => [s.btn, s.apple, pressed && { opacity: 0.85 }]}
        >
          {busy === 'apple' ? <ActivityIndicator color="#fff" /> : <AppleLogo />}
          <Text style={[s.text, { color: '#fff' }]}>Continuar com Apple</Text>
        </Pressable>
      )}
    </View>
  );
}

export function OrDivider({ label = 'ou' }: { label?: string }) {
  return (
    <View style={s.divider}>
      <View style={s.line} />
      <Text style={s.or}>{label}</Text>
      <View style={s.line} />
    </View>
  );
}

const s = StyleSheet.create({
  col: { gap: 12 },
  btn: { minHeight: 56, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  google: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.line },
  apple: { backgroundColor: colors.ink },
  text: { fontFamily: fonts.bodyBold, fontSize: 16 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.mute },
});
