import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { AuthShell } from '../../components/AuthShell';
import { Field, type FieldHandle } from '../../components/Field';
import { OrDivider, SocialButtons } from '../../components/SocialButtons';
import { Button } from '../../components/ui';
import { isEmail } from '../../lib/validation';
import { colors, fonts } from '../../theme';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const passwordRef = useRef<FieldHandle>(null);

  const emailError = touched && !isEmail(email) ? 'Digite um e-mail válido.' : null;
  const passwordError = touched && !password ? 'Digite sua senha.' : null;

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!isEmail(email) || !password) return;
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) setError(result.message);
    // Sucesso: a sessão muda e o roteador troca de tela sozinho.
  };

  return (
    <AuthShell title="Que bom te ver de novo" subtitle="Entre para ver seu histórico e seus alertas." mood={error ? 'triste' : 'feliz'}>
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        placeholder="voce@email.com"
      />
      <Field
        ref={passwordRef}
        label="Senha"
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        password
        textContentType="password"
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        placeholder="Sua senha"
      />

      <Link href="/forgot" style={s.forgot} accessibilityRole="link">
        Esqueci minha senha
      </Link>

      {!!error && (
        <View style={s.errorBox} accessibilityLiveRegion="polite">
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <Button label={busy ? 'Entrando…' : 'Entrar'} tone="ink" disabled={busy} onPress={submit} />

      <OrDivider />
      <SocialButtons onError={setError} />

      <View style={s.footer}>
        <Text style={s.footerText}>Ainda não tem conta? </Text>
        <Link href="/register" style={s.footerLink} accessibilityRole="link">
          Criar conta
        </Link>
      </View>
    </AuthShell>
  );
}

const s = StyleSheet.create({
  forgot: { alignSelf: 'flex-end', fontFamily: fonts.bodyBold, fontSize: 14, color: colors.leafDeep, marginTop: -6 },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.danger },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  footerText: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
  footerLink: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
