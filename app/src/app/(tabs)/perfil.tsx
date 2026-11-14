import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../../api/client';
import type { AllergenId, ProfileData, RestrictionId } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { StateView } from '../../components/State';
import { Body, Button, Card, Chip, H1, H2 } from '../../components/ui';
import { apiErrorText, useAsync } from '../../data/hooks';
import { ALLERGENS, RESTRICTIONS } from '../../data/options';
import { colors, fonts } from '../../theme';

const EMPTY: ProfileData = { goals: [], allergens: [], restrictions: [], lessSugar: false, lessSodium: false };

export default function Perfil() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const loaded = useAsync(() => api.getProfile(), []);
  const [profile, setProfile] = useState<ProfileData>(EMPTY);
  const [consented, setConsented] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const ready = useRef(false);

  useEffect(() => {
    if (!loaded.data) return;
    setProfile(loaded.data.profile ?? EMPTY);
    setConsented(!!loaded.data.consentAt);
    ready.current = true;
  }, [loaded.data]);

  const name = typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : '';

  const save = async (next: ProfileData) => {
    const hasHealth = next.goals.length + next.allergens.length + next.restrictions.length > 0;
    if (hasHealth && !consented) {
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert(
          'Guardar dados de saúde?',
          'Para personalizar os alertas, o Pomo guarda suas alergias e restrições. Você pode apagar tudo quando quiser.',
          [
            { text: 'Agora não', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Autorizar', onPress: () => resolve(true) },
          ],
          { onDismiss: () => resolve(false) },
        ),
      );
      if (!ok) return;
    }
    const previous = profile;
    setProfile(next);
    try {
      const res = await api.putProfile(next, consented || hasHealth);
      setConsented(!!res.consentAt);
      setSaveError(false);
    } catch {
      setProfile(previous);
      setSaveError(true);
    }
  };

  const toggleAllergen = (id: AllergenId) =>
    save({ ...profile, allergens: profile.allergens.includes(id) ? profile.allergens.filter((x) => x !== id) : [...profile.allergens, id] });

  const setRestriction = (id: RestrictionId | 'nenhuma') =>
    save({ ...profile, restrictions: id === 'nenhuma' ? [] : id === 'vegano' ? ['vegetariano', 'vegano'] : ['vegetariano'] });

  const restrictionNow: RestrictionId | 'nenhuma' = profile.restrictions.includes('vegano')
    ? 'vegano'
    : profile.restrictions.includes('vegetariano')
      ? 'vegetariano'
      : 'nenhuma';

  const confirmDelete = () =>
    Alert.alert('Excluir conta?', 'Isso apaga sua conta, perfil e histórico. Não dá para desfazer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAccount();
            await signOut();
          } catch (e) {
            Alert.alert(
              'Não foi possível excluir',
              e instanceof ApiError && e.status === 503
                ? 'Exclusão ainda não disponível, fale com o suporte.'
                : 'Tente novamente em instantes.',
            );
          }
        },
      },
    ]);

  return (
    <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <H1>Seu perfil</H1>

      <Card style={{ gap: 2 }}>
        {!!name && <Text style={s.name}>{name}</Text>}
        <Text style={s.email}>{user?.email}</Text>
      </Card>

      {loaded.loading && !loaded.data ? (
        <StateView text="Carregando seu perfil..." />
      ) : loaded.error ? (
        <StateView mood="triste" text={apiErrorText(loaded.error)} action="Tentar de novo" onAction={loaded.reload} />
      ) : (
        <>
          {saveError && <Body style={{ color: colors.danger }}>Não foi possível salvar agora. Tente de novo.</Body>}

          <View style={{ gap: 12 }}>
            <H2>Alergias</H2>
            <View style={s.chips}>
              {ALLERGENS.map((a) => (
                <Chip key={a.id} label={a.label} on={profile.allergens.includes(a.id)} onPress={() => toggleAllergen(a.id)} />
              ))}
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <H2>Alimentação</H2>
            <View style={s.chips}>
              {RESTRICTIONS.map((r) => (
                <Chip key={r.id} label={r.label} on={restrictionNow === r.id} onPress={() => setRestriction(r.id)} />
              ))}
            </View>
          </View>

          <Card style={{ gap: 4 }}>
            <Row label="Evitar açúcar" value={profile.lessSugar} onChange={(v) => save({ ...profile, lessSugar: v })} />
            <View style={s.sep} />
            <Row label="Evitar sódio" value={profile.lessSodium} onChange={(v) => save({ ...profile, lessSodium: v })} />
          </Card>
        </>
      )}

      <Card style={s.plus}>
        <H2 style={{ color: '#fff' }}>Pomo+</H2>
        <Text style={s.plusText}>Leitura personalizada, alternativas melhores e conversa com a IA sobre cada produto.</Text>
        <Button label="Conhecer o Pomo+" tone="leaf" />
      </Card>

      <Card style={{ gap: 12 }}>
        <H2>Sua conta</H2>
        <Button label="Sair" tone="ghost" onPress={() => signOut()} />
        <Body mute>Você pode apagar a conta e tudo o que guardamos a qualquer momento.</Body>
        <Button label="Excluir minha conta" tone="ghost" onPress={confirmDelete} />
      </Card>
    </ScrollView>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ true: colors.leaf, false: colors.line }} thumbColor="#fff" />
    </View>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 48, gap: 24 },
  name: { fontFamily: fonts.displayMid, fontSize: 20, color: colors.ink },
  email: { fontFamily: fonts.body, fontSize: 14, color: colors.mute },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
  sep: { height: 1, backgroundColor: colors.line },
  plus: { backgroundColor: colors.ink, gap: 12 },
  plusText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: '#C9C9D1' },
});
