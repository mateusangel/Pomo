import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import type { StatsSummary } from '../api/types';
import { ExplainCard } from '../components/ExplainCard';
import { Icon } from '../components/Icon';
import { StateView } from '../components/State';
import { Body, Card, Chip, H1, H2 } from '../components/ui';
import { apiErrorText, useAsync } from '../data/hooks';
import { bandStyle, colors, fonts } from '../theme';

const PERIODS = [7, 30, 90] as const;

const TREND: Record<StatsSummary['trend'], string> = {
  subiu: 'Suas escolhas estão melhorando',
  caiu: 'Suas escolhas pioraram um pouco',
  estavel: 'Suas escolhas estão estáveis',
  sem_dados: 'Escaneie mais produtos para ver a evolução',
};

const BANDS = [
  { key: 'excelente', label: 'Excelente', color: bandStyle.excelente.bg },
  { key: 'bom', label: 'Bom', color: bandStyle.bom.bg },
  { key: 'regular', label: 'Regular', color: bandStyle.regular.bg },
  { key: 'ruim', label: 'Ruim', color: bandStyle.ruim.bg },
] as const;

export default function Evolucao() {
  const insets = useSafeAreaInsets();
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const stats = useAsync(() => api.stats(days), [days]);
  const data = stats.data;

  const scored = data ? BANDS.reduce((sum, b) => sum + data.bandCounts[b.key], 0) : 0;
  const maxSugar = data ? Math.max(1, ...data.daily.map((d) => d.sugarG)) : 1;

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[s.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable accessibilityLabel="Voltar" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={{ alignSelf: 'flex-start' }}>
        <Icon name="back" />
      </Pressable>
      <H1>Sua evolução</H1>

      <View style={s.chips}>
        {PERIODS.map((p) => (
          <Chip key={p} label={`${p} dias`} on={days === p} onPress={() => setDays(p)} />
        ))}
      </View>

      {stats.loading && !data && <StateView mood="neutro" text="Calculando..." />}
      {stats.error && <StateView mood="triste" text={apiErrorText(stats.error)} action="Tentar de novo" onAction={stats.reload} />}

      {data && data.totalScans === 0 && (
        <StateView mood="neutro" text="Nenhum produto registrado neste período. Escaneie alimentos para acompanhar sua evolução." />
      )}

      {data && data.totalScans > 0 && (
        <>
          <Card style={{ gap: 4 }}>
            <Text style={s.big}>{data.averageScore ?? '—'}</Text>
            <Body mute>nota média em {data.totalScans} registros ({data.uniqueProducts} produtos diferentes)</Body>
            <Text style={s.trend}>
              {TREND[data.trend]}
              {data.trendDelta !== null && data.trend !== 'estavel' ? ` (${data.trendDelta > 0 ? '+' : ''}${String(data.trendDelta).replace('.', ',')} pontos)` : ''}
            </Text>
          </Card>

          <Card style={{ gap: 12 }}>
            <H2>Como foram suas escolhas</H2>
            {BANDS.map((b) => (
              <View key={b.key} style={s.barRow}>
                <Text style={s.barLabel}>{b.label}</Text>
                <View style={s.track}>
                  <View style={[s.fill, { backgroundColor: b.color, width: `${scored ? Math.max((data.bandCounts[b.key] / scored) * 100, data.bandCounts[b.key] ? 4 : 0) : 0}%` }]} />
                </View>
                <Text style={s.barCount}>{data.bandCounts[b.key]}</Text>
              </View>
            ))}
            {data.bandCounts.sem_nota > 0 && <Body mute style={s.small}>{data.bandCounts.sem_nota} sem dados suficientes para nota.</Body>}
          </Card>

          <Card style={{ gap: 12 }}>
            <H2>Açúcar e sódio (estimativa)</H2>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.metric}>{String(data.estimatedSugarG).replace('.', ',')} g</Text>
                <Body mute style={s.small}>de açúcar</Body>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.metric}>{data.estimatedSodiumMg} mg</Text>
                <Body mute style={s.small}>de sódio</Body>
              </View>
            </View>
            {data.daily.length > 0 && (
              <View style={s.chart} accessibilityLabel="Açúcar estimado por dia">
                {data.daily.slice(-30).map((d) => (
                  <View key={d.date} style={[s.chartBar, { height: Math.max(4, (d.sugarG / maxSugar) * 70) }]} />
                ))}
              </View>
            )}
            <Body mute style={s.small}>
              Estimativa: cada registro conta como 100 g ou 100 ml do produto, já que o app não sabe quanto você comeu. Serve para comparar períodos, não como medida exata.
            </Body>
          </Card>

          {data.frequentBad.length > 0 && (
            <Card style={{ gap: 10 }}>
              <H2>Produtos ruins que mais aparecem</H2>
              {data.frequentBad.map((p) => (
                <Pressable key={p.barcode} onPress={() => router.push({ pathname: '/produto/[barcode]', params: { barcode: p.barcode } })} style={s.badRow}>
                  <Text style={s.badName} numberOfLines={1}>{p.name}</Text>
                  <Text style={s.badCount}>{p.count}x</Text>
                </Pressable>
              ))}
            </Card>
          )}

          <ExplainCard request={{ module: 'evolucao', days }} label="Pomo.ai, interprete minha evolução" />
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 16 },
  chips: { flexDirection: 'row', gap: 10 },
  big: { fontFamily: fonts.display, fontSize: 64, lineHeight: 66, letterSpacing: -2, color: colors.ink },
  trend: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.leafDeep, marginTop: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 76, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.paper, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  barCount: { width: 28, textAlign: 'right', fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
  metric: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.8, color: colors.ink },
  small: { fontSize: 13, lineHeight: 19 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 74 },
  chartBar: { flex: 1, backgroundColor: colors.leaf, borderRadius: 3 },
  badRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  badName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  badCount: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.danger, marginLeft: 12 },
});
