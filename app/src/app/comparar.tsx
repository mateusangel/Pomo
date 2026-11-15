import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { ExplainCard } from '../components/ExplainCard';
import { Icon } from '../components/Icon';
import { ScoreBadge } from '../components/ProductRow';
import { StateView } from '../components/State';
import { Body, Button, Card, H1, H2 } from '../components/ui';
import { apiErrorText, useAsync } from '../data/hooks';
import { colors, fonts, radius } from '../theme';

const MAX = 3;

const format = (v: number | null) => (v === null ? '—' : String(v).replace('.', ','));

export default function Comparar() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ barcodes?: string }>();
  const barcodes = (params.barcodes ?? '').split(',').filter(Boolean).slice(0, MAX);
  const ready = barcodes.length >= 2;

  const result = useAsync(
    () => (ready ? api.compare(barcodes) : Promise.resolve(null)),
    [params.barcodes],
  );

  const setBarcodes = (next: string[]) =>
    router.setParams({ barcodes: next.join(',') });

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const add = () => router.push({ pathname: '/search', params: { pick: '1', current: barcodes.join(',') } });

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[s.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable accessibilityLabel="Voltar" hitSlop={12} onPress={back} style={{ alignSelf: 'flex-start' }}>
        <Icon name="back" />
      </Pressable>
      <H1>Comparar</H1>
      <Body mute>Escolha 2 ou 3 produtos para ver lado a lado qual combina mais com você.</Body>

      {barcodes.length < MAX && <Button label={barcodes.length === 0 ? 'Escolher produtos' : 'Adicionar produto'} tone="ghost" onPress={add} />}

      {!ready && barcodes.length === 1 && (
        <Card>
          <Body mute>Falta pelo menos mais um produto para comparar.</Body>
        </Card>
      )}

      {ready && result.loading && !result.data && <StateView mood="neutro" text="Comparando..." />}
      {ready && result.error && (
        <StateView mood="triste" text={apiErrorText(result.error)} action="Tentar de novo" onAction={result.reload} />
      )}

      {result.data && ready && (
        <>
          <View style={s.cols}>
            {result.data.products.map((a) => (
              <View key={a.product.barcode} style={s.col}>
                <Pressable
                  accessibilityLabel={`Remover ${a.product.name}`}
                  hitSlop={8}
                  onPress={() => setBarcodes(barcodes.filter((b) => b !== a.product.barcode))}
                  style={s.remove}
                >
                  <Icon name="close" size={16} />
                </Pressable>
                <ScoreBadge analysis={a} size={56} />
                <Text style={s.colName} numberOfLines={3}>{a.product.name}</Text>
                {result.data!.comparison.recommendation?.barcode === a.product.barcode && (
                  <View style={s.best}><Text style={s.bestText}>Melhor para você</Text></View>
                )}
              </View>
            ))}
          </View>

          {result.data.comparison.recommendation && (
            <Card style={{ backgroundColor: colors.leafSoft, gap: 4 }}>
              <H2>{result.data.products.find((p) => p.product.barcode === result.data!.comparison.recommendation!.barcode)?.product.name}</H2>
              <Body>{result.data.comparison.recommendation.reason}</Body>
            </Card>
          )}
          {result.data.comparison.notice && (
            <Card style={{ backgroundColor: colors.amberSoft }}>
              <Body>{result.data.comparison.notice}</Body>
            </Card>
          )}

          <Card style={{ gap: 0, padding: 14 }}>
            {result.data.comparison.rows.map((row, ri) => (
              <View key={row.key} style={[s.row, ri > 0 && s.rowBorder]}>
                <Text style={s.rowLabel}>{row.label}</Text>
                <View style={s.values}>
                  {row.values.map((v, i) => (
                    <Text
                      key={result.data!.products[i]!.product.barcode}
                      style={[s.value, row.bestIndex === i && s.valueBest]}
                    >
                      {format(v)}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
            <Body mute style={s.hint}>Valores por 100 g ou 100 ml. Verde = melhor valor da linha.</Body>
          </Card>

          <ExplainCard request={{ module: 'comparacao', barcodes }} label="Pomo.ai, compare pra mim" />
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 16 },
  cols: { flexDirection: 'row', gap: 10 },
  col: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, gap: 8, alignItems: 'center' },
  colName: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink, textAlign: 'center' },
  remove: { position: 'absolute', top: 8, right: 8, zIndex: 1 },
  best: { backgroundColor: colors.leaf, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  bestText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.ink },
  row: { paddingVertical: 12, gap: 6 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.mute },
  values: { flexDirection: 'row' },
  value: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  valueBest: { color: colors.leafDeep },
  hint: { fontSize: 12, marginTop: 8 },
});
