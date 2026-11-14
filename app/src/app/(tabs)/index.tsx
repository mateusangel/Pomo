import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { Icon } from '../../components/Icon';
import { Pomo } from '../../components/Pomo';
import { ProductRow } from '../../components/ProductRow';
import { StateView } from '../../components/State';
import { Body, H1, H2 } from '../../components/ui';
import { apiErrorText, useAsync } from '../../data/hooks';
import { colors, fonts, radius } from '../../theme';

export default function Inicio() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const history = useAsync(() => api.history(), []);
  const name = typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name.split(' ')[0] : '';

  const { reload } = history;
  useFocusEffect(useCallback(() => reload(), [reload]));

  const items = history.data?.items.slice(0, 3) ?? [];

  return (
    <ScrollView contentContainerStyle={[s.page, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <H1>{name ? `Oi, ${name}!` : 'Oi!'} O que vamos{'\n'}escanear hoje?</H1>

      <Pressable accessibilityRole="button" onPress={() => router.push('/scan')} style={({ pressed }) => [s.cta, pressed && { opacity: 0.92 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.ctaTitle}>Escanear código{'\n'}de barras</Text>
          <View style={s.ctaBtn}>
            <Icon name="scan" size={20} color={colors.ink} />
            <Text style={s.ctaBtnText}>Abrir câmera</Text>
          </View>
        </View>
        <Pomo size={132} mood="feliz" />
      </Pressable>

      <Pressable accessibilityRole="search" accessibilityLabel="Buscar pelo nome do produto" onPress={() => router.push('/search')} style={s.search}>
        <Icon name="search" color={colors.mute} />
        <Text style={s.searchText}>Buscar pelo nome do produto</Text>
      </Pressable>

      <Pressable accessibilityRole="button" accessibilityLabel="Conversar com o Pomo.ai" onPress={() => router.push('/chat')} style={({ pressed }) => [s.chat, pressed && { opacity: 0.9 }]}>
        <View style={s.chatIcon}>
          <Icon name="chat" color={colors.ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.chatTitle}>Converse com o Pomo.ai</Text>
          <Text style={s.chatSub}>Tire dúvidas sobre rótulos e ingredientes</Text>
        </View>
        <Icon name="chevron" color="#fff" />
      </Pressable>

      <View style={s.head}>
        <H2>Escaneados recentemente</H2>
        <Pressable onPress={() => router.push('/historico')} hitSlop={8}>
          <Text style={s.link}>Ver tudo</Text>
        </Pressable>
      </View>

      {history.loading && !history.data ? (
        <StateView mood="neutro" text="Carregando seu histórico..." />
      ) : history.error ? (
        <StateView mood="triste" text={apiErrorText(history.error)} action="Tentar de novo" onAction={reload} />
      ) : items.length === 0 ? (
        <StateView mood="feliz" text="Nada por aqui ainda. Escaneie seu primeiro alimento." />
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((i) => (
            <ProductRow key={i.product.barcode} analysis={i.analysis} />
          ))}
        </View>
      )}

      <Body mute style={s.note}>A nota é calculada por regras fixas e vale para todo mundo. Seu perfil só define quais alertas aparecem.</Body>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 48, gap: 20 },
  cta: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.leaf, borderRadius: radius.xl, padding: 24, paddingRight: 12, overflow: 'hidden' },
  ctaTitle: { fontFamily: fonts.display, fontSize: 26, lineHeight: 28, letterSpacing: -0.8, color: colors.ink },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', alignSelf: 'flex-start', paddingHorizontal: 16, height: 44, borderRadius: 22, marginTop: 18 },
  ctaBtnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, backgroundColor: colors.card, borderRadius: 26, paddingHorizontal: 18 },
  searchText: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
  chat: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.ink, borderRadius: radius.lg, padding: 16 },
  chatIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' },
  chatTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: '#fff' },
  chatSub: { fontFamily: fonts.body, fontSize: 13, color: '#C9C9D1', marginTop: 2 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.leafDeep },
  note: { fontSize: 13, lineHeight: 19, marginTop: 8 },
});
