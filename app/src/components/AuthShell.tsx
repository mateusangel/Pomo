import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../theme';
import { Icon } from './Icon';
import { Pomo, type PomoMood } from './Pomo';
import { H1 } from './ui';

interface Props {
  title: string;
  subtitle?: string;
  mood?: PomoMood;
  back?: boolean;
  children: ReactNode;
}

/** Moldura das telas de login/cadastro: topo verde com o Pomo e formulário em folha branca. */
export function AuthShell({ title, subtitle, mood = 'feliz', back, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={[s.hero, { paddingTop: insets.top + 12 }]}>
          {back ? (
            <Pressable
              accessibilityLabel="Voltar"
              hitSlop={12}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
              style={s.back}
            >
              <Icon name="back" />
            </Pressable>
          ) : (
            <Text style={s.brand}>pomo</Text>
          )}
          <View style={s.mascot}>
            <Pomo size={132} mood={mood} />
          </View>
        </View>

        <View style={[s.sheet, { paddingBottom: insets.bottom + 28 }]}>
          <H1 style={s.title}>{title}</H1>
          {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          <View style={s.form}>{children}</View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.leaf },
  hero: { backgroundColor: colors.leaf, paddingHorizontal: 24, height: 250 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -1, color: colors.ink, height: 44, lineHeight: 44 },
  mascot: { position: 'absolute', right: 20, bottom: 18 },
  sheet: {
    flex: 1,
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.xl + 8,
    borderTopRightRadius: radius.xl + 8,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  title: { fontSize: 32, lineHeight: 34 },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.mute, marginTop: 8 },
  form: { gap: 16, marginTop: 24 },
});
