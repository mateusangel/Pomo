import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProductAnalysis } from '../api/types';
import { bandStyle, colors, fonts, radius } from '../theme';

export function ScoreBadge({ analysis, size = 52 }: { analysis: ProductAnalysis; size?: number }) {
  if (analysis.score.status !== 'ok') {
    return (
      <View style={[s.badge, { width: size, height: size, backgroundColor: colors.line }]}>
        <Text style={[s.badgeText, { fontSize: size * 0.4 }]}>?</Text>
      </View>
    );
  }
  return (
    <View style={[s.badge, { width: size, height: size, backgroundColor: bandStyle[analysis.score.band].bg }]}>
      <Text style={[s.badgeText, { fontSize: size * 0.4 }]}>{analysis.score.score}</Text>
    </View>
  );
}

export function ProductRow({ analysis }: { analysis: ProductAnalysis }) {
  const { product, score, alerts } = analysis;
  const hasAlert = alerts.alerts.length > 0;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/produto/[barcode]', params: { barcode: product.barcode } })}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}
    >
      <ScoreBadge analysis={analysis} />
      <View style={s.info}>
        <Text style={s.name} numberOfLines={1}>{product.name}</Text>
        <Text style={s.meta} numberOfLines={1}>
          {product.brand}
          {score.status === 'ok' ? ` • ${bandStyle[score.band].label}` : ' • Dados incompletos'}
        </Text>
      </View>
      {hasAlert && <View style={s.alertDot} accessibilityLabel="Tem alerta de alergia" />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: radius.md, padding: 12 },
  badge: { borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, color: colors.ink, letterSpacing: -0.5 },
  info: { flex: 1 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.mute, marginTop: 2 },
  alertDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
});
