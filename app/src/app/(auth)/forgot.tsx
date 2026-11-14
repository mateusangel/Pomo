import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { AuthShell } from '../../components/AuthShell';
import { Field } from '../../components/Field';
import { Body, Button } from '../../components/ui';
import { isEmail } from '../../lib/validation';
import { colors, fonts } from '../../theme';

const COOLDOWN_S = 60;

export default function Forgot() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const emailError = touched && !isEmail(email) ? 'Digite um e-mail válido.' : null;

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!isEmail(email) || wait > 0) return;
    setBusy(true);
    const result = await sendPasswordReset(email);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setSent(true);
    setWait(COOLDOWN_S);
  };

  if (sent) {
    return (
      <AuthShell title="Olhe seu e-mail" subtitle={`Se existir uma conta com ${email.trim()}, enviamos um link para criar uma nova senha.`} mood="feliz" back>
        <Body mute>O link vale por pouco tempo. Se não chegar, confira o spam.</Body>
        <Button
          label={wait > 0 ? `Reenviar em ${wait}s` : 'Reenviar e-mail'}
          tone="ghost"
          disabled={wait > 0 || busy}
          style={wait > 0 ? { opacity: 0.5 } : undefined}
          onPress={submit}
        />
        {!!error && <Text style={s.errorText}>{error}</Text>}
        <Button label="Voltar para o login" onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Esqueceu a senha?" subtitle="Sem problema. Digite seu e-mail e enviamos um link para criar outra." mood="neutro" back>
      <Field
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={emailError}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={submit}
        placeholder="voce@email.com"
      />
      {!!error && (
        <View style={s.errorBox} accessibilityLiveRegion="polite">
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}
      <Button label={busy ? 'Enviando…' : 'Enviar link'} disabled={busy} onPress={submit} />
    </AuthShell>
  );
}

const s = StyleSheet.create({
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.danger },
});
