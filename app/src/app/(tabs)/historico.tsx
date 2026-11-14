import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { ProductRow } from '../../components/ProductRow';
import { StateView } from '../../components/State';
import { H1 } from '../../components/ui';
import { apiErrorText, useAsync } from '../../data/hooks';

export default function Historico() {
  const insets = useSafeAreaInsets();
  const history = useAsync(() => api.history(), []);
  const [refreshing, setRefreshing] = useState(false);
  const { reload } = history;

  useFocusEffect(useCallback(() => reload(), [reload]));

  const onRefresh = () => {
    setRefreshing(true);
    reload();
    setTimeout(() => setRefreshing(false), 600);
  };

  const empty = history.loading && !history.data ? (
    <StateView mood="neutro" text="Carregando seu histórico..." />
  ) : history.error ? (
    <StateView mood="triste" text={apiErrorText(history.error)} action="Tentar de novo" onAction={reload} />
  ) : (
    <StateView mood="neutro" text="Nada por aqui ainda. Escaneie seu primeiro alimento." />
  );

  return (
    <FlatList
      data={history.data?.items ?? []}
      keyExtractor={(i) => `${i.product.barcode}-${i.scannedAt}`}
      contentContainerStyle={[s.page, { paddingTop: insets.top + 16 }]}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponent={<H1 style={{ marginBottom: 12 }}>Histórico</H1>}
      renderItem={({ item }) => <ProductRow analysis={item.analysis} />}
      ListEmptyComponent={empty}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 48 },
});
