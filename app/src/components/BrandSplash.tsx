import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme';

/** Mesma largura (dp) configurada no plugin expo-splash-screen do app.json, para a marca não "pular". */
const LOGO = 200;

/** Splash com a logo do Pomo, mostrada logo depois do login até a tela principal abrir. */
export function BrandSplash() {
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduce) return;
    pulse.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) })),
      -1,
    );
  }, [reduce, pulse]);

  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(260)}
      style={s.root}
      accessibilityLabel="Carregando o Pomo"
      accessibilityLiveRegion="polite"
      pointerEvents="auto"
    >
      <Animated.Image source={require('../../assets/splash-icon.png')} resizeMode="contain" style={[s.logo, logoStyle]} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  logo: { width: LOGO, height: LOGO },
});
