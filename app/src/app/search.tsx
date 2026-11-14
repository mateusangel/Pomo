import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { Icon } from '../components/Icon';
import { ProductRow } from '../components/ProductRow';
import { StateView } from '../components/State';
import { apiErrorText, useAsync } from '../data/hooks';
import { colors, fonts } from '../theme';

export default function Search() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 400);
    return () => clearTimeout(t);
  }, [text]);

  const active = query.length >= 2;
  const result = useAsync(() => (active ? api.search(query) : Promise.resolve({ results: [] })), [query, active]);

  let empty;
  if (!active) empty = <StateView mood="neutro" text="Digite ao menos 2 letras para buscar produtos já cadastrados." />;
  else if (result.loading) empty = <StateView mood="neutro" text="Buscando..." />;
  else if (result.error) empty = <StateView mood="triste" text={apiErrorText(result.error)} action="Tentar de novo" onAction={result.reload} />;
  else empty = <StateView mood="triste" text="Não achei nada com esse nome. Tente escanear o código de barras." />;

  return (
    <View style={[s.screen, { paddingTop: insets.top + 12 }]}>
      <View style={s.top}>
        <Pressable accessibilityLabel="Voltar" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Icon name="back" />
        </Pressable>
        <View style={s.field}>
          <Icon name="search" color={colors.mute} size={20} />
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Nome do produto"
            placeholderTextColor={colors.mute}
            autoFocus
            returnKeyType="search"
            accessibilityLabel="Buscar pelo nome do produto"
          />
        </View>
      </View>
      <FlatList
        data={active && !result.loading && !result.error ? result.data?.results ?? [] : []}
        keyExtractor={(a) => a.product.barcode}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => <ProductRow analysis={item} />}
        ListEmptyComponent={empty}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, backgroundColor: colors.card, borderRadius: 26, paddingHorizontal: 18 },
  input: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
});
