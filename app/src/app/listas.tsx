import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { ExplainCard } from '../components/ExplainCard';
import { Icon } from '../components/Icon';
import { ProductRow } from '../components/ProductRow';
import { StateView } from '../components/State';
import { Body, H1 } from '../components/ui';
import { apiErrorText, useAsync } from '../data/hooks';
import { colors, fonts, radius } from '../theme';

export default function Listas() {
  const insets = useSafeAreaInsets();
  const list = useAsync(() => api.favorites(), []);
  const { reload } = list;
  useFocusEffect(useCallback(() => reload(), [reload]));

  const items = list.data?.items ?? [];
  const swaps = items.filter((i) => i.suggestion);

  const remove = async (barcode: string) => {
    try {
      await api.removeFavorite(barcode);
    } finally {
      reload();
    }
  };

  const swap = async (from: string, to: string) => {
    try {
      await api.addFavorite(to);
      await api.removeFavorite(from);
    } finally {
      reload();
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.paper }}
      contentContainerStyle={[s.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <Pressable accessibilityLabel="Voltar" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} style={{ alignSelf: 'flex-start' }}>
        <Icon name="back" />
      </Pressable>
      <H1>Minha lista</H1>
      <Body mute>Salve produtos na tela deles. Quando um item for ruim, sugerimos uma troca da mesma categoria.</Body>

      {list.loading && !list.data && <StateView mood="neutro" text="Carregando sua lista..." />}
      {list.error && <StateView mood="triste" text={apiErrorText(list.error)} action="Tentar de novo" onAction={reload} />}

      {list.data && items.length === 0 && (
        <StateView mood="neutro" text="Sua lista está vazia. Abra um produto e toque em “Salvar na lista”." />
      )}

      {items.map((item) => (
        <View key={item.product.barcode} style={s.item}>
          <View style={s.itemTop}>
            <View style={{ flex: 1 }}>
              <ProductRow analysis={item.analysis} />
            </View>
            <Pressable
              accessibilityLabel={`Remover ${item.product.name} da lista`}
              hitSlop={10}
              onPress={() => remove(item.product.barcode)}
              style={s.remove}
            >
              <Icon name="close" size={18} color={colors.mute} />
            </Pressable>
          </View>

          {item.suggestion && (
            <View style={s.suggestion}>
              <Text style={s.suggestionTitle}>Sugestão de troca</Text>
              <ProductRow analysis={item.suggestion.analysis} />
              <Text style={s.reason}>+{item.suggestion.scoreGain} pontos • {item.suggestion.reason}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => swap(item.product.barcode, item.suggestion!.analysis.product.barcode)}
                style={({ pressed }) => [s.swapBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={s.swapText}>Trocar na lista</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}

      {items.length > 0 && (
        <>
          {swaps.length === 0 && <Body mute style={{ fontSize: 13 }}>Nenhum item da lista precisa de troca agora.</Body>}
          <ExplainCard request={{ module: 'listas' }} label="Pomo.ai, avalie minha lista" />
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, gap: 16 },
  item: { gap: 8 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  remove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  suggestion: { backgroundColor: colors.leafSoft, borderRadius: radius.md, padding: 12, gap: 8 },
  suggestionTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.leafDeep },
  reason: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.leafDeep },
  swapBtn: { minHeight: 44, borderRadius: radius.xl, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  swapText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff' },
});
