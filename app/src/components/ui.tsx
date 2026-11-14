import { Pressable, StyleSheet, Text, View, type PressableProps, type TextProps, type ViewStyle } from 'react-native';
import { colors, fonts, radius } from '../theme';

export function H1(props: TextProps) {
  return <Text {...props} style={[s.h1, props.style]} />;
}
export function H2(props: TextProps) {
  return <Text {...props} style={[s.h2, props.style]} />;
}
export function Body(props: TextProps & { mute?: boolean }) {
  return <Text {...props} style={[s.body, props.mute && { color: colors.mute }, props.style]} />;
}

export function Button({
  label,
  tone = 'ink',
  style,
  ...rest
}: PressableProps & { label: string; tone?: 'ink' | 'leaf' | 'ghost'; style?: ViewStyle }) {
  const bg = tone === 'ink' ? colors.ink : tone === 'leaf' ? colors.leaf : 'transparent';
  const fg = tone === 'ink' ? '#fff' : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      {...rest}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }, tone === 'ghost' && s.ghost, style]}
    >
      <Text style={[s.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      onPress={onPress}
      style={[s.chip, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}
    >
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

const s = StyleSheet.create({
  h1: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, letterSpacing: -1, color: colors.ink },
  h2: { fontFamily: fonts.displayMid, fontSize: 20, lineHeight: 24, letterSpacing: -0.4, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  btn: { height: 56, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  ghost: { borderWidth: 1.5, borderColor: colors.ink },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  chip: { paddingHorizontal: 16, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, justifyContent: 'center' },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 20 },
});
