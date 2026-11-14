import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Nutrition, ProductAnalysis } from '../../api/types';
import { Icon } from '../../components/Icon';
import { Pomo, type PomoMood } from '../../components/Pomo';
import { Body, Button, Card, H1, H2 } from '../../components/ui';
import { api, ApiError } from '../../api/client';
import { StateView } from '../../components/State';
import { apiErrorText, useAsync } from '../../data/hooks';
import { bandStyle, colors, fonts, radius } from '../../theme';

const MOOD = { excelente: 'feliz', bom: 'feliz', regular: 'neutro', ruim: 'triste' } as const;

export default function Produto() {
  const { barcode, fromScan } = useLocalSearchParams<{ barcode: string; fromScan?: string }>();
  const insets = useSafeAreaInsets();
  const state = useAsync(() => (fromScan === '1' ? api.scan(barcode) : api.product(barcode)), [barcode, fromScan]);
  const analysis = state.data;

  if (state.loading) {
    return (
      <View style={[s.nf, { paddingTop: insets.top + 16 }]}>
        <StateView mood="neutro" text="Lendo o rótulo..." />
      </View>
    );
  }
  if (state.error?.status === 404) return <NotFound barcode={barcode} top={insets.top} bottom={insets.bottom} />;
  if (state.error || !analysis) return <Failure error={state.error} onRetry={state.reload} top={insets.top} />;

  const { product, score, alerts, additives } = analysis;
  const ok = score.status === 'ok' ? score : null;
  const bg = ok ? bandStyle[ok.band].bg : colors.line;
  const mood: PomoMood = alerts.alerts.some((a) => a.level === 'contem') ? 'alerta' : ok ? MOOD[ok.band] : 'neutro';

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View style={[s.hero, { backgroundColor: bg, paddingTop: insets.top + 12 }]}>
          <Pressable accessibilityLabel="Voltar" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={s.back}>
            <Icon name="back" />
          </Pressable>
          <View style={s.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.score} accessibilityLabel={ok ? `Nota ${ok.score} de 100` : 'Sem nota'}>
                {ok ? ok.score : '?'}
              </Text>
              <Text style={s.band}>{ok ? bandStyle[ok.band].label : 'Dados incompletos'}</Text>
            </View>
            <Pomo size={150} mood={mood} />
          </View>
          <Text style={s.name}>{product.name}</Text>
          <Text style={s.brand}>{[product.brand, product.category].filter(Boolean).join(' • ')}</Text>
        </View>

        <View style={s.content}>
          <Alerts analysis={analysis} />

          <Button label="Perguntar ao Pomo.ai" tone="leaf" onPress={() => router.push({ pathname: '/chat', params: { barcode: product.barcode } })} />

          {ok && ok.warnings.length > 0 && (
            <View style={s.lupa}>
              {ok.warnings.map((w) => (
                <View key={w.nutrient} style={s.lupaItem}>
                  <Text style={s.lupaSmall}>ALTO EM</Text>
                  <Text style={s.lupaBig}>{w.label.replace(/^Alto em /, '')}</Text>
                </View>
              ))}
            </View>
          )}

          {ok && (
            <Card style={{ gap: 14 }}>
              <H2>Por que essa nota</H2>
              {ok.positives.map((t) => <Point key={t} text={t} good />)}
              {ok.negatives.map((t) => <Point key={t} text={t} />)}
              <View style={s.sep} />
              {ok.breakdown.map((b) => <Bar key={b.label} label={b.label} points={b.points} />)}
              <Body mute style={s.small}>Nota calculada por regras fixas (versão {analysis.scoreVersion}). Seu perfil não altera a nota.</Body>
            </Card>
          )}

          <Card style={{ gap: 4 }}>
            <H2 style={{ marginBottom: 8 }}>Tabela nutricional <Text style={s.per}>por {product.isLiquid ? '100 ml' : '100 g'}</Text></H2>
            <Nutri label="Energia" v={product.nutrition.energyKcal} unit="kcal" />
            <Nutri label="Açúcares" v={product.nutrition.sugarsG} unit="g" />
            <Nutri label="Açúcares adicionados" v={product.nutrition.addedSugarsG} unit="g" />
            <Nutri label="Gordura saturada" v={product.nutrition.saturatedFatG} unit="g" />
            <Nutri label="Sódio" v={product.nutrition.sodiumMg} unit="mg" />
            <Nutri label="Fibras" v={product.nutrition.fiberG} unit="g" />
            <Nutri label="Proteínas" v={product.nutrition.proteinG} unit="g" last />
          </Card>

          {additives.length > 0 && (
            <Card style={{ gap: 14 }}>
              <H2>Aditivos</H2>
              {additives.map((a) => (
                <View key={a.code} style={{ gap: 2 }}>
                  <Text style={s.addName}>{a.name} <Text style={s.per}>{a.code}</Text></Text>
                  <Body mute style={s.small}>{a.explanation}</Body>
                </View>
              ))}
            </Card>
          )}

          {product.ingredientsText && (
            <Card style={{ gap: 8 }}>
              <H2>Ingredientes</H2>
              <Body mute>{product.ingredientsText}</Body>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Failure({ error, onRetry, top }: { error: ApiError | null; onRetry: () => void; top: number }) {
  const invalid = error?.code === 'invalid_barcode';
  return (
    <View style={[s.nf, { paddingTop: top + 16 }]}>
      <Pressable accessibilityLabel="Voltar" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={{ alignSelf: 'flex-start' }}>
        <Icon name="back" />
      </Pressable>
      <StateView
        mood="triste"
        text={invalid ? 'Esse código de barras é inválido. Confira os números e tente de novo.' : apiErrorText(error)}
        {...(invalid ? {} : { action: 'Tentar de novo', onAction: onRetry })}
      />
    </View>
  );
}

function Alerts({ analysis }: { analysis: ProductAnalysis }) {
  const { alerts } = analysis;
  if (alerts.alerts.length === 0 && alerts.dataComplete) {
    return (
      <View style={[s.alertBox, { backgroundColor: colors.leafSoft }]}>
        <Icon name="check" color={colors.leafDeep} />
        <Text style={[s.alertTitle, { color: colors.leafDeep }]}>Nenhum alérgeno seu encontrado</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      {alerts.alerts.map((a) => {
        const contem = a.level === 'contem';
        return (
          <View key={a.item} style={[s.alertBox, { backgroundColor: contem ? colors.dangerSoft : colors.amberSoft }]}>
            <Icon name="alert" color={contem ? colors.danger : colors.amberDeep} />
            <View style={{ flex: 1 }}>
              <Text style={[s.alertTitle, { color: contem ? colors.danger : colors.amberDeep }]}>
                {contem ? 'Contém' : 'Pode conter'} {a.item.toLowerCase()}
              </Text>
              <Text style={s.alertReason}>{a.reason}</Text>
            </View>
          </View>
        );
      })}
      {!alerts.dataComplete && (
        <View style={[s.alertBox, { backgroundColor: colors.amberSoft }]}>
          <Icon name="alert" color={colors.amberDeep} />
          <Text style={[s.alertReason, { flex: 1 }]}>{alerts.notice ?? 'Faltam dados deste produto. Confira o rótulo antes de consumir.'}</Text>
        </View>
      )}
    </View>
  );
}

function Point({ text, good }: { text: string; good?: boolean }) {
  return (
    <View style={s.point}>
      <View style={[s.pointIcon, { backgroundColor: good ? colors.leafSoft : colors.dangerSoft }]}>
        <Icon name={good ? 'check' : 'close'} size={14} color={good ? colors.leafDeep : colors.danger} />
      </View>
      <Text style={s.pointText}>{text}</Text>
    </View>
  );
}

function Bar({ label, points }: { label: string; points: number }) {
  const w = Math.min(Math.abs(points), 40) / 40;
  return (
    <View style={s.barRow}>
      <Text style={s.barLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${Math.max(w * 100, 4)}%`, backgroundColor: points >= 0 ? colors.leaf : colors.danger }]} />
      </View>
      <Text style={s.barPts}>{points > 0 ? `+${points}` : points}</Text>
    </View>
  );
}

function Nutri({ label, v, unit, last }: { label: string; v?: number; unit: string; last?: boolean }) {
  return (
    <View style={[s.nRow, !last && s.nBorder]}>
      <Text style={s.nLabel}>{label}</Text>
      <Text style={s.nVal}>{v == null ? 'não informado' : `${String(v).replace('.', ',')} ${unit}`}</Text>
    </View>
  );
}

function NotFound({ barcode, top, bottom }: { barcode: string; top: number; bottom: number }) {
  return (
    <View style={[s.nf, { paddingTop: top + 16, paddingBottom: bottom + 24 }]}>
      <Pressable accessibilityLabel="Voltar" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={{ alignSelf: 'flex-start' }}>
        <Icon name="back" />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <Pomo size={160} mood="triste" />
        <H1 style={{ textAlign: 'center' }}>Não achei esse produto</H1>
        <Body mute style={{ textAlign: 'center', maxWidth: 300 }}>O código {barcode} não está na nossa base. Tire uma foto do rótulo para cadastrar.</Body>
      </View>
      <Button label="Fotografar o rótulo" />
      <Button label="Escanear outro" tone="ghost" style={{ marginTop: 10 }} onPress={() => router.replace('/scan')} />
    </View>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 28, borderBottomLeftRadius: 36, borderBottomRightRadius: 36 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  score: { fontFamily: fonts.display, fontSize: 132, lineHeight: 128, letterSpacing: -6, color: colors.ink },
  band: { fontFamily: fonts.displayMid, fontSize: 24, letterSpacing: -0.5, color: colors.ink },
  name: { fontFamily: fonts.displayMid, fontSize: 22, lineHeight: 26, letterSpacing: -0.4, color: colors.ink, marginTop: 18 },
  brand: { fontFamily: fonts.body, fontSize: 14, color: colors.ink, opacity: 0.7, marginTop: 2 },
  content: { padding: 20, gap: 16 },
  alertBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md },
  alertTitle: { fontFamily: fonts.bodyBold, fontSize: 16 },
  alertReason: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  lupa: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  lupaItem: { backgroundColor: colors.ink, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 4 },
  lupaSmall: { fontFamily: fonts.bodyMedium, fontSize: 10, color: '#fff', letterSpacing: 0.4 },
  lupaBig: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
  sep: { height: 1, backgroundColor: colors.line },
  small: { fontSize: 13, lineHeight: 19 },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 120, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.paper, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  barPts: { width: 34, textAlign: 'right', fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  per: { fontFamily: fonts.body, fontSize: 13, color: colors.mute },
  nRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  nBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  nLabel: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  nVal: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  addName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  nf: { flex: 1, backgroundColor: colors.paper, paddingHorizontal: 24 },
});
