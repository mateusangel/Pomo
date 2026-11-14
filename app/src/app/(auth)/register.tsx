import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { AuthShell } from '../../components/AuthShell';
import { Field, type FieldHandle } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { OrDivider, SocialButtons } from '../../components/SocialButtons';
import { Body, Button } from '../../components/ui';
import { checkPassword, isEmail } from '../../lib/validation';
import { colors, fonts } from '../../theme';

const STRENGTH_COLORS = [colors.danger, '#FCD34D', '#BEF264', colors.leaf] as const;

export default function Register() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const emailRef = useRef<FieldHandle>(null);
  const passwordRef = useRef<FieldHandle>(null);

  const strength = checkPassword(password);
  const nameError = touched && name.trim().length < 2 ? 'Como podemos te chamar?' : null;
  const emailError = touched && !isEmail(email) ? 'Digite um e-mail válido.' : null;
  const passwordError = touched && !strength.valid ? 'Use 8 ou mais caracteres, com letras e números.' : null;

  const submit = async () => {
    setTouched(true);
    setError(null);
    if (name.trim().length < 2 || !isEmail(email) || !strength.valid) return;
    if (!terms) return setError('Aceite os termos para criar sua conta.');
    setBusy(true);
    const result = await signUp(name, email, password);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    if (result.confirmEmail) setSentTo(email.trim());
    // Sem confirmação de e-mail, a sessão já existe e o roteador segue para o onboarding.
  };

  if (sentTo) {
    return (
      <AuthShell title="Confirme seu e-mail" subtitle={`Enviamos um link para ${sentTo}. Toque nele para ativar sua conta e depois volte aqui.`} mood="feliz" back>
        <Body mute>Não achou? Olhe a caixa de spam.</Body>
        <Button label="Já confirmei, entrar" onPress={() => router.replace('/login')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Crie sua conta" subtitle="Leva um minuto. Depois montamos seu perfil juntos." mood={error ? 'alerta' : 'feliz'} back>
      <Field
        label="Seu nome"
        value={name}
        onChangeText={setName}
        error={nameError}
        autoCapitalize="words"
        textContentType="givenName"
        autoComplete="given-name"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        placeholder="Como quer ser chamado"
      />
      <Field
        ref={emailRef}
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
      <View style={{ gap: 8 }}>
        <Field
          ref={passwordRef}
          label="Senha"
          value={password}
          onChangeText={setPassword}
          error={passwordError}
          password
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="done"
          placeholder="Mínimo de 8 caracteres"
        />
        {password.length > 0 && (
          <View style={s.strengthRow} accessibilityLabel={`Força da senha: ${strength.label}`}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[s.bar, { backgroundColor: strength.valid && i < strength.level ? STRENGTH_COLORS[strength.level] : colors.line }]}
              />
            ))}
            <Text style={s.strengthText}>{strength.label}</Text>
          </View>
        )}
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: terms }}
        onPress={() => setTerms(!terms)}
        style={s.terms}
      >
        <View style={[s.box, terms && { backgroundColor: colors.ink }]}>{terms && <Icon name="check" size={16} color="#fff" />}</View>
        <Text style={s.termsText}>Li e aceito os Termos de Uso e a Política de Privacidade do Pomo.</Text>
      </Pressable>

      {!!error && (
        <View style={s.errorBox} accessibilityLiveRegion="polite">
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <Button label={busy ? 'Criando conta…' : 'Criar conta'} disabled={busy} onPress={submit} />

      <OrDivider />
      <SocialButtons onError={setError} />

      <View style={s.footer}>
        <Text style={s.footerText}>Já tem conta? </Text>
        <Link href="/login" style={s.footerLink} accessibilityRole="link">
          Entrar
        </Link>
      </View>
    </AuthShell>
  );
}

const s = StyleSheet.create({
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bar: { flex: 1, height: 5, borderRadius: 3 },
  strengthText: { width: 44, textAlign: 'right', fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.mute },
  terms: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  termsText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: 14, padding: 14 },
  errorText: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.danger },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  footerText: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
  footerLink: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
});
