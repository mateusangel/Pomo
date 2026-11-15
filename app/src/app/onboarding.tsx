import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeInRight,
  FadeOutLeft,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AllergenId, ProfileData, RestrictionId } from '../api/types';
import { Icon } from '../components/Icon';
import { Pomo, type PomoMood } from '../components/Pomo';
import { PomoBubble } from '../components/PomoBubble';
import { Body, Button, Chip, H1 } from '../components/ui';
import { ALLERGENS, GOALS, RESTRICTIONS, allergenLabel } from '../data/options';
import { useOnboarding } from '../onboarding/OnboardingProvider';
import { savePending } from '../onboarding/storage';
import { colors, fonts, radius } from '../theme';

type StepId = 'welcome' | 'name' | 'goals' | 'diet' | 'allergies' | 'care' | 'demo' | 'final';
const STEPS: StepId[] = ['welcome', 'name', 'goals', 'diet', 'allergies', 'care', 'demo', 'final'];

const tap = () => Haptics.selectionAsync().catch(() => {});

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { markSeen } = useOnboarding();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [diet, setDiet] = useState<RestrictionId | 'nenhuma'>('nenhuma');
  const [allergens, setAllergens] = useState<AllergenId[]>([]);
  const [noAllergy, setNoAllergy] = useState(false);
  const [lessSugar, setLessSugar] = useState(false);
  const [lessSodium, setLessSodium] = useState(false);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bounce, setBounce] = useState(0);

  const id = STEPS[step]!;
  const first = name.trim().split(/\s+/)[0] ?? '';
  const hasHealthData = allergens.length > 0 || goals.length > 0 || diet !== 'nenhuma' || lessSugar || lessSodium;

  const poke = () => {
    tap();
    setBounce((b) => b + 1);
  };

  const toggleGoal = (g: string) => {
    poke();
    const on = !goals.includes(g);
    setGoals(on ? [...goals, g] : goals.filter((x) => x !== g));
    if (g === 'Controlar açúcar') setLessSugar(on);
    if (g === 'Reduzir sódio') setLessSodium(on);
  };

  const toggleAllergen = (a: AllergenId) => {
    poke();
    setNoAllergy(false);
    setAllergens(allergens.includes(a) ? allergens.filter((x) => x !== a) : [...allergens, a]);
  };

  const canContinue =
    id === 'name' ? first.length >= 2 : id === 'allergies' ? noAllergy || allergens.length > 0 : id === 'final' ? !hasHealthData || consent : true;

  const next = () => {
    tap();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => {
    setStep((s) => Math.max(s - 1, 0));
  };

  // O onboarding vem antes da conta: guarda as respostas no aparelho e envia à API depois do login.
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    const profile: ProfileData = {
      goals,
      allergens,
      restrictions: diet === 'nenhuma' ? [] : [diet],
      lessSugar,
      lessSodium,
    };
    await savePending({ name: name.trim(), profile, consent });
    await markSeen();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.replace('/register');
  };

  // Quem já tem conta (ou reinstalou o app) pula direto para o login.
  const skipToLogin = async () => {
    tap();
    await markSeen();
    router.replace('/login');
  };

  // Mensagem e humor do Pomo em cada passo.
  const bubble = (): { text: string; mood: PomoMood } => {
    switch (id) {
      case 'name':
        return { text: first.length >= 2 ? `Prazer, ${first}! Eu sou o Pomo.` : 'Oi! Eu sou o Pomo. Como posso te chamar?', mood: 'feliz' };
      case 'goals':
        return { text: goals.length ? `Boa${first ? `, ${first}` : ''}! Vou lembrar disso.` : 'O que te trouxe aqui? Marque o que quiser.', mood: 'feliz' };
      case 'diet':
        return { text: 'Como você come no dia a dia? Assim eu aviso o que não combina.', mood: 'neutro' };
      case 'allergies':
        return allergens.length
          ? { text: `Fico de olho em ${allergens.map((a) => allergenLabel(a).toLowerCase()).join(', ')} para você.`, mood: 'alerta' }
          : { text: 'Alergia é sério. Marque tudo que você precisa evitar.', mood: 'neutro' };
      case 'care':
        return { text: 'Quer que eu destaque açúcar e sódio nos produtos?', mood: 'feliz' };
      case 'demo':
        return { text: 'Veja como vai ficar. Toque para escanear o exemplo!', mood: 'feliz' };
      default:
        return { text: 'Tudo pronto! Só falta confirmar.', mood: 'feliz' };
    }
  };

  if (id === 'welcome') {
    // Tamanhos acompanham a tela: celulares pequenos, grandes, paisagem e tablets.
    const mascot = Math.round(Math.min(Math.max(Math.min(width * 0.6, height * 0.3), 120), 260));
    const titleSize = width < 360 ? 34 : width < 400 ? 38 : 44;
    return (
      <View
        style={[
          s.hero,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, paddingLeft: Math.max(24, insets.left), paddingRight: Math.max(24, insets.right) },
        ]}
      >
        <ScrollView contentContainerStyle={s.heroScroll} showsVerticalScrollIndicator={false} bounces={false}>
          <Animated.View entering={FadeInDown.duration(600)} style={s.heroCenter}>
            <Pomo size={mascot} mood="feliz" />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(250).duration(500)}>
            <H1 maxFontSizeMultiplier={1.2} style={[s.heroTitle, { fontSize: titleSize, lineHeight: titleSize + 2 }]}>
              {first ? `Oi, ${first}!` : 'Oi!'}{'\n'}Veja o que tem{'\n'}no seu prato.
            </H1>
            <Body style={s.heroSub}>Em 1 minuto montamos seu perfil. Depois é só escanear e receber nota e alertas.</Body>
            <Button label="Vamos lá" tone="ink" onPress={next} />
            <Pressable accessibilityRole="button" hitSlop={8} onPress={skipToLogin} style={s.haveAccount}>
              <Text style={s.haveAccountText}>Já tenho conta</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  const b = bubble();
  const progress = (step - 1) / (STEPS.length - 2);

  return (
    <KeyboardAvoidingView style={[s.screen, { paddingTop: insets.top + 12 }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.topRow}>
        <Pressable accessibilityLabel="Voltar" hitSlop={12} onPress={back} style={s.backBtn}>
          <Icon name="back" />
        </Pressable>
        <View style={s.track} accessibilityLabel={`Passo ${step} de ${STEPS.length - 1}`}>
          <ProgressFill value={progress} />
        </View>
        <Text style={s.count}>{step}/{STEPS.length - 1}</Text>
      </View>

      <View style={s.bubbleWrap}>
        <PomoBubble text={b.text} mood={b.mood} bounceKey={bounce} />
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View key={id} entering={FadeInRight.duration(260)} exiting={FadeOutLeft.duration(120)} style={{ gap: 20 }}>
          {id === 'name' && (
            <>
              <H1>Como podemos{'\n'}te chamar?</H1>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Seu nome"
                placeholderTextColor={colors.mute}
                autoCapitalize="words"
                autoComplete="given-name"
                returnKeyType="next"
                maxLength={30}
                onSubmitEditing={() => first.length >= 2 && next()}
                accessibilityLabel="Seu nome"
                style={s.nameInput}
              />
            </>
          )}

          {id === 'goals' && (
            <>
              <H1>O que você quer{'\n'}melhorar?</H1>
              <Body mute>Escolha quantos quiser. Isso não muda a nota, só o que destacamos para você.</Body>
              <View style={s.chips}>
                {GOALS.map((g) => (
                  <Chip key={g} label={g} on={goals.includes(g)} onPress={() => toggleGoal(g)} />
                ))}
              </View>
            </>
          )}

          {id === 'diet' && (
            <>
              <H1>Você segue alguma{'\n'}dieta?</H1>
              <View style={{ gap: 10 }}>
                {RESTRICTIONS.map((r) => {
                  const on = diet === r.id;
                  return (
                    <Pressable
                      key={r.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      onPress={() => {
                        poke();
                        setDiet(r.id);
                      }}
                      style={[s.option, on && s.optionOn]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[s.optionTitle, on && { color: '#fff' }]}>{r.label}</Text>
                        <Text style={[s.optionHint, on && { color: '#C9C9D1' }]}>{r.hint}</Text>
                      </View>
                      <View style={[s.radio, on && { borderColor: colors.leaf, backgroundColor: colors.leaf }]}>
                        {on && <Icon name="check" size={14} color={colors.ink} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {id === 'allergies' && (
            <>
              <H1>Você tem alguma{'\n'}alergia?</H1>
              <Body mute>Avisamos quando um produto contiver ou puder conter o que você marcar.</Body>
              <View style={s.chips}>
                {ALLERGENS.map((a) => (
                  <Chip key={a.id} label={a.label} on={allergens.includes(a.id)} onPress={() => toggleAllergen(a.id)} />
                ))}
              </View>
              <Chip
                label="Não tenho alergias"
                on={noAllergy}
                onPress={() => {
                  poke();
                  setNoAllergy(!noAllergy);
                  setAllergens([]);
                }}
              />
            </>
          )}

          {id === 'care' && (
            <>
              <H1>Quer cuidar de{'\n'}algo a mais?</H1>
              <ToggleCard title="Evitar açúcar" hint="Destaco açúcar adicionado nos produtos" value={lessSugar} onChange={(v) => { poke(); setLessSugar(v); }} />
              <ToggleCard title="Evitar sódio" hint="Destaco sal em excesso" value={lessSodium} onChange={(v) => { poke(); setLessSodium(v); }} />
            </>
          )}

          {id === 'demo' && <Demo />}

          {id === 'final' && (
            <>
              <H1>{first ? `Pronto, ${first}!` : 'Pronto!'}{'\n'}Seu perfil:</H1>
              <View style={s.summary}>
                <SummaryRow label="Objetivos" values={goals} empty="Nenhum" />
                <SummaryRow label="Dieta" values={diet === 'nenhuma' ? [] : [RESTRICTIONS.find((r) => r.id === diet)!.label]} empty="Como de tudo" />
                <SummaryRow label="Alergias" values={allergens.map(allergenLabel)} empty="Nenhuma" danger />
                <SummaryRow label="Atenção a" values={[lessSugar && 'Açúcar', lessSodium && 'Sódio'].filter((x): x is string => !!x)} empty="Nada extra" last />
              </View>
              {hasHealthData && (
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} style={s.consent}>
                  <View style={[s.box, consent && { backgroundColor: colors.ink }]}>{consent && <Icon name="check" size={16} color="#fff" />}</View>
                  <Text style={s.consentText}>
                    Autorizo o Pomo a guardar minhas alergias e objetivos para personalizar os avisos. Posso apagar tudo quando quiser.
                  </Text>
                </Pressable>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>

      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {id === 'final' ? (
          <Button
            label={saving ? 'Salvando…' : 'Criar minha conta'}
            tone="leaf"
            disabled={!canContinue || saving}
            style={!canContinue || saving ? { opacity: 0.4 } : undefined}
            onPress={finish}
          />
        ) : (
          <Button
            label={id === 'demo' ? 'Continuar' : id === 'allergies' && !allergens.length && !noAllergy ? 'Marque uma opção' : 'Continuar'}
            disabled={!canContinue}
            style={!canContinue ? { opacity: 0.4 } : undefined}
            onPress={next}
          />
        )}
        {id === 'final' && !canContinue && <Body mute style={s.hint}>Marque a autorização para guardar seus dados de saúde.</Body>}
      </View>
    </KeyboardAvoidingView>
  );
}

function ProgressFill({ value }: { value: number }) {
  const w = useSharedValue(value);
  useEffect(() => {
    w.value = withTiming(value, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [value, w]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(0.04, w.value) * 100}%` }));
  return <Animated.View style={[s.fill, style]} />;
}

function ToggleCard({ title, hint, value, onChange }: { title: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={[s.option, value && s.optionOn]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.optionTitle, value && { color: '#fff' }]}>{title}</Text>
        <Text style={[s.optionHint, value && { color: '#C9C9D1' }]}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.leaf, false: colors.line }} thumbColor="#fff" />
    </Pressable>
  );
}

function SummaryRow({ label, values, empty, danger, last }: { label: string; values: string[]; empty: string; danger?: boolean; last?: boolean }) {
  return (
    <View style={[s.sumRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
      <Text style={s.sumLabel}>{label}</Text>
      <View style={s.sumValues}>
        {values.length === 0 ? (
          <Text style={s.sumEmpty}>{empty}</Text>
        ) : (
          values.map((v) => (
            <View key={v} style={[s.pill, danger && { backgroundColor: colors.dangerSoft }]}>
              <Text style={[s.pillText, danger && { color: colors.danger }]}>{v}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

/** Demonstração com um produto de exemplo (dados fixos, só ilustram como o resultado aparece). */
function Demo() {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [shown, setShown] = useState(0);
  const line = useSharedValue(0);
  const TARGET = 22;

  useEffect(() => {
    if (phase !== 'scanning') return;
    line.value = 0;
    line.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
    const t = setTimeout(() => setPhase('done'), 1800);
    return () => clearTimeout(t);
  }, [phase, line]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (phase !== 'done') return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    let n = 0;
    timer.current = setInterval(() => {
      n += 1;
      setShown(Math.min(TARGET, Math.round((n / 18) * TARGET)));
      if (n >= 18 && timer.current) clearInterval(timer.current);
    }, 40);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [phase]);

  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: line.value * 96 }] }));

  return (
    <>
      <H1>Veja na prática</H1>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Escanear produto de exemplo"
        disabled={phase === 'scanning'}
        onPress={() => {
          tap();
          setShown(0);
          setPhase('scanning');
        }}
        style={s.demoCard}
      >
        <View style={s.demoTop}>
          <View style={s.pack}>
            <Text style={s.packText}>Biscoito{'\n'}recheado</Text>
            {phase === 'scanning' && <Animated.View style={[s.scanLine, lineStyle]} />}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.exLabel}>EXEMPLO</Text>
            <Text style={s.demoName}>Biscoito recheado chocolate</Text>
            {phase === 'idle' && <Text style={s.demoHint}>Toque para escanear</Text>}
            {phase === 'scanning' && <Text style={s.demoHint}>Lendo código de barras…</Text>}
          </View>
        </View>

        {phase === 'done' && (
          <Animated.View entering={FadeInDown.duration(350)} style={{ gap: 12 }}>
            <View style={s.scoreRow}>
              <View style={s.scoreBadge}>
                <Text style={s.scoreNum}>{shown}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.scoreBand}>Ruim</Text>
                <Text style={s.demoHint}>Nota de 0 a 100, igual para todo mundo</Text>
              </View>
            </View>
            <View style={s.demoAlert}>
              <Icon name="alert" color={colors.danger} />
              <Text style={s.demoAlertText}>Contém leite, trigo e soja. Se você marcou algum, o aviso aparece assim.</Text>
            </View>
          </Animated.View>
        )}
      </Pressable>
      <Body mute style={{ fontSize: 13 }}>A nota segue regras fixas e nunca muda com o seu perfil. O perfil só decide quais alertas aparecem.</Body>
    </>
  );
}

const s = StyleSheet.create({
  hero: { flex: 1, backgroundColor: colors.leaf },
  heroScroll: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  heroCenter: { flex: 1, minHeight: 140, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  haveAccount: { alignSelf: 'center', paddingVertical: 14 },
  haveAccountText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, textDecorationLine: 'underline' },
  heroTitle: { fontSize: 44, lineHeight: 46, letterSpacing: -1.6, marginBottom: 12 },
  heroSub: { fontSize: 17, lineHeight: 24, marginBottom: 28, maxWidth: 340 },
  screen: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.paper },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, height: 44 },
  backBtn: { width: 28 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.ink },
  count: { width: 28, textAlign: 'right', fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.mute },
  bubbleWrap: { paddingHorizontal: 20, paddingTop: 12 },
  body: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  nameInput: { height: 64, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.ink, paddingHorizontal: 20, fontFamily: fonts.displayMid, fontSize: 24, color: colors.ink },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, padding: 18, borderWidth: 1.5, borderColor: colors.line },
  optionOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionTitle: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink },
  optionHint: { fontFamily: fonts.body, fontSize: 14, color: colors.mute, marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  summary: { backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 18 },
  sumRow: { paddingVertical: 14, gap: 8 },
  sumLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.mute },
  sumValues: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sumEmpty: { fontFamily: fonts.body, fontSize: 15, color: colors.mute },
  pill: { backgroundColor: colors.leafSoft, paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center' },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.leafDeep },
  consent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  consentText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink },
  footer: { paddingHorizontal: 24, paddingTop: 12 },
  hint: { textAlign: 'center', marginTop: 10, fontSize: 13 },
  demoCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, gap: 16 },
  demoTop: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  pack: { width: 96, height: 120, borderRadius: 14, backgroundColor: '#8B4A2B', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  packText: { fontFamily: fonts.display, fontSize: 15, color: '#fff', textAlign: 'center' },
  scanLine: { position: 'absolute', top: 6, left: 0, right: 0, height: 3, backgroundColor: colors.leaf },
  exLabel: { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1, color: colors.mute },
  demoName: { fontFamily: fonts.displayMid, fontSize: 18, color: colors.ink },
  demoHint: { fontFamily: fonts.body, fontSize: 13, color: colors.mute },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scoreBadge: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#FB7185', alignItems: 'center', justifyContent: 'center' },
  scoreNum: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -1 },
  scoreBand: { fontFamily: fonts.displayMid, fontSize: 22, color: colors.ink },
  demoAlert: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: 14 },
  demoAlertText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.danger },
});
