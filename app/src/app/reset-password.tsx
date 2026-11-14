import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { AuthShell } from '../components/AuthShell';
import { Field } from '../components/Field';
import { Body, Button } from '../components/ui';
import { checkPassword } from '../lib/validation';
import { colors, fonts } from '../theme';

/** Destino do link do e-mail de recuperação (pomo://reset-password?code=...). */
export default function ResetPassword() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { exchangeCode, updatePassword, session } = useAuth();
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const exchanged = useRef(false);

  useEffect(() => {
    if (!code || exchanged.current) return;
    exchanged.current = true;
    exchangeCode(code).then((r) => (r.ok ? setReady(true) : setLinkError(r.message)));
  }, [code, exchangeCode]);

  const check = checkPassword(password);
  const passwordError = touched && !check.valid ? 'Use 8 ou mais caracteres, com letras e números.' : null;
  const confirmError = touched && confirm !== password ? 'As senhas não são iguais.' : null;
  const canEdit = ready || (!code && !!session);

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (!check.valid || confirm !== password) return;
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setDone(true);
  };

  if (done) {
    return (
      <AuthShell title="Senha atualizada" subtitle="Tudo certo! Você já está dentro com a nova senha." mood="feliz">
        <Button label="Continuar" onPress={() => router.replace('/')} />
      </AuthShell>
    );
  }

  if (linkError || (!code && !session)) {
    return (
      <AuthShell title="Link inválido" subtitle={linkError ?? 'Este link expirou ou já foi usado. Peça um novo e-mail de recuperação.'} mood="triste">
        <Button label="Pedir novo link" onPress={() => router.replace('/forgot')} />
      </AuthShell>
    );
  }

  if (!canEdit) {
    return (
      <AuthShell title="Validando link…" mood="neutro">
        <Body mute>Só um instante.</Body>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Crie uma nova senha" subtitle="Escolha uma senha que você não use em outros lugares." mood="feliz">
      <Field
        label="Nova senha"
        value={password}
        onChangeText={setPassword}
        error={passwordError}
        password
        textContentType="newPassword"
        autoComplete="new-password"
        placeholder="Mínimo de 8 caracteres"
      />
      <Field
        label="Repita a senha"
        value={confirm}
        onChangeText={setConfirm}
        error={confirmError}
        password
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={submit}
        placeholder="Digite de novo"
      />
      {!!error && (
        <View style={s.errorBox} accessibilityLiveRegion="polite">
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}
      <Button label={busy ? 'Salvando…' : 'Salvar nova senha'} disabled={busy} onPress={submit} />
    </AuthShell>
  );
}

const s = StyleSheet.create({
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.danger },
});
