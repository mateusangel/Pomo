import { useEffect } from 'react';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path } from 'react-native-svg';
import { colors } from '../theme';

const AEllipse = Animated.createAnimatedComponent(Ellipse);

export type PomoMood = 'feliz' | 'neutro' | 'triste' | 'alerta';

const MOUTH: Record<PomoMood, string> = {
  feliz: 'M184 262 C194 276 206 276 216 262',
  neutro: 'M188 266 L212 266',
  triste: 'M184 274 C194 260 206 260 216 274',
  alerta: 'M200 258 m-8 0 a8 9 0 1 0 16 0 a8 9 0 1 0 -16 0',
};

/** Mascote do Pomo (a partir de pomo/pomo-preto.svg), com piscada e humor. */
export function Pomo({ size = 120, mood = 'neutro', body = colors.ink }: { size?: number; mood?: PomoMood; body?: string }) {
  const reduce = useReducedMotion();
  const open = useSharedValue(1);

  useEffect(() => {
    if (reduce) return;
    open.value = withRepeat(
      withSequence(withDelay(2600, withTiming(0.08, { duration: 80 })), withTiming(1, { duration: 120 })),
      -1,
    );
  }, [reduce, open]);

  const baseRy = mood === 'alerta' ? 31 : mood === 'feliz' ? 24 : 26;
  const eyeProps = useAnimatedProps(() => ({ ry: baseRy * open.value }));
  const eyeY = mood === 'triste' ? 214 : 210;

  return (
    <Svg width={size} height={size} viewBox="0 0 400 400" accessibilityLabel="Mascote Pomo">
      <Path
        d="M200 132 C158 104 92 132 92 206 C92 272 140 334 174 334 C189 334 193 325 200 325 C207 325 211 334 226 334 C260 334 308 272 308 206 C308 132 242 104 200 132 Z"
        fill={body}
      />
      <Path d="M200 132 C200 110 206 94 220 82" fill="none" stroke="#3A3A42" strokeWidth={11} strokeLinecap="round" />
      <Path d="M213 108 C228 76 262 72 278 85 C267 112 234 123 213 108 Z" fill={colors.leaf} />
      <AEllipse cx={171} cy={eyeY} rx={13} fill="#fff" animatedProps={eyeProps} />
      <AEllipse cx={229} cy={eyeY} rx={13} fill="#fff" animatedProps={eyeProps} />
      <Path
        d={MOUTH[mood]}
        fill={mood === 'alerta' ? '#fff' : 'none'}
        stroke="#fff"
        strokeWidth={8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
