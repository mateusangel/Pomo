import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Moldura das telas de login/cadastro: topo verde com o Pomo e formulário em folha clara.
 * Responsiva: o topo e o texto acompanham a altura/largura da tela (celular pequeno, grande,
 * paisagem, tablet), respeita as áreas seguras e sobe com o teclado.
 */
export function AuthShell({ title, subtitle, mood = 'feliz', back, children }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const landscape = width > height;
  // Em paisagem (ou telas muito baixas) o topo encolhe para sobrar espaço ao formulário.
  const heroHeight = landscape || height < 520 ? 96 : Math.round(clamp(height * 0.26, 150, 260));
  const mascotSize = Math.round(clamp(heroHeight * 0.55, 64, 150));
  const gutter = Math.round(clamp(width * 0.06, 20, 32));
  const titleSize = Math.round(clamp(width * 0.08, 26, 34));
  const sideLeft = Math.max(gutter, insets.left);
  const sideRight = Math.max(gutter, insets.right);

  return (
    <KeyboardAvoidingView style={s.root} behavior="padding">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Coluna central: em tablets o conteúdo não estica; as laterais ficam verdes. */}
        <View style={s.column}>
          <View style={[s.hero, { height: heroHeight + insets.top, paddingTop: insets.top + 12, paddingLeft: sideLeft, paddingRight: sideRight }]}>
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
              <Text style={s.brand} maxFontSizeMultiplier={1.2}>pomo</Text>
            )}
            <View style={[s.mascot, { right: Math.max(16, insets.right + 8) }]}>
              <Pomo size={mascotSize} mood={mood} />
            </View>
          </View>

          <View style={[s.sheet, { paddingBottom: insets.bottom + 28, paddingLeft: sideLeft, paddingRight: sideRight }]}>
            <H1 maxFontSizeMultiplier={1.2} style={{ fontSize: titleSize, lineHeight: titleSize + 2 }}>
              {title}
            </H1>
            {!!subtitle && (
              <Text style={s.subtitle} maxFontSizeMultiplier={1.3}>
                {subtitle}
              </Text>
            )}
            <View style={s.form}>{children}</View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.leaf },
  scroll: { flexGrow: 1 },
  column: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  hero: { backgroundColor: colors.leaf },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: fonts.display, fontSize: 28, letterSpacing: -1, color: colors.ink, height: 44, lineHeight: 44 },
  mascot: { position: 'absolute', bottom: 14 },
  sheet: {
    flex: 1,
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.xl + 8,
    borderTopRightRadius: radius.xl + 8,
    paddingTop: 28,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.mute, marginTop: 8 },
  form: { gap: 16, marginTop: 24 },
});
