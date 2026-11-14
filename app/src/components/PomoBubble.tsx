import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors, fonts, radius } from '../theme';
import { Pomo, type PomoMood } from './Pomo';

/** Pomo falando: mascote com balão. O balão anima a cada mensagem e o mascote "pula" quando `bounceKey` muda. */
export function PomoBubble({ text, mood = 'feliz', bounceKey }: { text: string; mood?: PomoMood; bounceKey?: unknown }) {
  const y = useSharedValue(0);

  useEffect(() => {
    if (bounceKey === undefined) return;
    y.value = withSequence(withTiming(-10, { duration: 110 }), withSpring(0, { damping: 6, stiffness: 220 }));
  }, [bounceKey, y]);

  const mascot = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={s.row}>
      <Animated.View style={mascot}>
        <Pomo size={84} mood={mood} />
      </Animated.View>
      <Animated.View key={text} entering={FadeIn.duration(220)} exiting={FadeOut.duration(100)} style={s.bubble}>
        <View style={s.tail} />
        <Text style={s.text}>{text}</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bubble: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1.5, borderColor: colors.line },
  tail: {
    position: 'absolute',
    left: -8,
    top: '50%',
    marginTop: -6,
    width: 12,
    height: 12,
    backgroundColor: colors.card,
    borderLeftWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: colors.line,
    transform: [{ rotate: '45deg' }],
  },
  text: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21, color: colors.ink },
});
