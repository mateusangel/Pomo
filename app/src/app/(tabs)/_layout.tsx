import { router, Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../components/Icon';
import { colors, fonts } from '../../theme';

const ITEMS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Início', icon: 'home' },
  { name: 'historico', label: 'Histórico', icon: 'clock' },
  { name: 'perfil', label: 'Perfil', icon: 'user' },
];

function TabBar({ state }: { state: { index: number; routes: { name: string }[] } }) {
  const insets = useSafeAreaInsets();
  const renderItem = (name: string) => {
    const item = ITEMS.find((i) => i.name === name)!;
    const idx = state.routes.findIndex((r) => r.name === name);
    const focused = state.index === idx;
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => router.navigate(name === 'index' ? '/(tabs)' : (`/(tabs)/${name}` as '/(tabs)/historico'))}
        style={s.item}
      >
        <Icon name={item.icon} color={focused ? colors.ink : colors.mute} />
        <Text style={[s.label, focused && { color: colors.ink, fontFamily: fonts.bodyBold }]}>{item.label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.bar, { paddingBottom: insets.bottom + 8 }]}>
      {renderItem('index')}
      {renderItem('historico')}
      <Pressable accessibilityRole="button" accessibilityLabel="Escanear alimento" onPress={() => router.push('/scan')} style={s.scan}>
        <Icon name="scan" size={28} color={colors.ink} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Conversar com o Pomo.ai" onPress={() => router.push('/chat')} style={s.item}>
        <Icon name="chat" color={colors.mute} />
        <Text style={s.label}>Pomo.ai</Text>
      </Pressable>
      {renderItem('perfil')}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.paper } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="historico" />
      <Tabs.Screen name="perfil" />
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: colors.card, paddingTop: 10, paddingHorizontal: 12, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.mute },
  scan: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center', marginTop: -30, marginHorizontal: 8, borderWidth: 5, borderColor: colors.paper },
});
