import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError } from '../api/client';
import type { ChatMessage } from '../api/types';
import { Icon } from '../components/Icon';
import { Pomo } from '../components/Pomo';
import { colors, fonts, radius } from '../theme';

interface Msg {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** Mensagem local (saudação/erro): nunca é enviada à API. */
  local?: boolean;
}

const WITH_PRODUCT = ['Esse produto é bom pra mim?', 'Tem alguma alternativa mais saudável?', 'O que significam esses aditivos?'];
const GENERAL = ['Como você calcula a nota?', 'Como lidar com alergia a leite?'];

let counter = 0;
const nid = () => `m${++counter}`;

function errorText(e: unknown): string {
  const status = e instanceof ApiError ? e.status : 0;
  if (status === 429) return 'Estou recebendo muitas perguntas agora. Espere um minutinho e tente de novo.';
  if (status === 503) return 'O Pomo.ai está indisponível no momento. Tente mais tarde.';
  if (status === 502) return 'Não consegui pensar numa resposta agora. Quer tentar de novo?';
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
}

/** Renderiza **negrito** simples. */
function RichText({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={[s.msgText, { color }]}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <Text key={i} style={{ fontFamily: fonts.bodyBold }}>{p.slice(2, -2)}</Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

function Dots() {
  const vals = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(v, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 320, useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [vals]);
  return (
    <View style={[s.bubble, s.model, { flexDirection: 'row', gap: 6, paddingVertical: 16 }]} accessibilityLabel="Pomo.ai está digitando">
      {vals.map((v, i) => (
        <Animated.View key={i} style={[s.dot, { opacity: v }]} />
      ))}
    </View>
  );
}

export default function Chat() {
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Msg>>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: nid(),
      role: 'model',
      local: true,
      text: barcode
        ? 'Oi! Estou olhando o produto que você acabou de escanear. O que você quer saber sobre ele?'
        : 'Oi! Eu sou o **Pomo.ai**. Posso explicar rótulos, ingredientes, aditivos e como a nota é calculada. O que você quer saber?',
    },
  ]);

  const suggestions = barcode ? WITH_PRODUCT : GENERAL;
  const hasUserMsg = messages.some((m) => m.role === 'user');

  const scrollEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

  const ask = async (history: Msg[]) => {
    setBusy(true);
    setFailed(false);
    const real: ChatMessage[] = history
      .filter((m) => !m.local)
      .slice(-12)
      .map((m) => ({ role: m.role, text: m.text }));
    // O histórico enviado precisa começar com uma mensagem do usuário.
    while (real.length && real[0]!.role !== 'user') real.shift();
    try {
      const { reply } = await api.chat(real, barcode);
      setMessages((m) => [...m, { id: nid(), role: 'model', text: reply }]);
    } catch (e) {
      setFailed(true);
      setMessages((m) => [...m, { id: nid(), role: 'model', local: true, text: errorText(e) }]);
    } finally {
      setBusy(false);
      scrollEnd();
    }
  };

  const send = (raw: string) => {
    const text = raw.trim().slice(0, 1000);
    if (!text || busy) return;
    const next = [...messages.filter((m) => !(m.local && failed && m === messages[messages.length - 1])), { id: nid(), role: 'user' as const, text }];
    setMessages(next);
    setInput('');
    scrollEnd();
    void ask(next);
  };

  const retry = () => {
    if (busy) return;
    // Remove o aviso de erro e reenvia o histórico (que termina na mensagem do usuário).
    const next = messages.slice(0, -1);
    setMessages(next);
    void ask(next);
  };

  return (
    <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.top, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityLabel="Voltar" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
          <Icon name="back" />
        </Pressable>
        <Text style={s.title}>Pomo.ai</Text>
        <Pomo size={40} mood={busy ? 'neutro' : 'feliz'} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={s.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => {
          const mine = item.role === 'user';
          const isLast = index === messages.length - 1;
          return (
            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 8 }}>
              <View style={[s.bubble, mine ? s.me : s.model]}>
                <RichText text={item.text} color={mine ? '#fff' : colors.ink} />
              </View>
              {failed && isLast && item.local && !mine && (
                <Pressable accessibilityRole="button" onPress={retry} style={s.retry}>
                  <Text style={s.retryText}>Tentar de novo</Text>
                </Pressable>
              )}
            </View>
          );
        }}
        ListFooterComponent={
          <View style={{ gap: 12 }}>
            {busy && <Dots />}
            {!hasUserMsg && !busy && (
              <View style={s.chips}>
                {suggestions.map((q) => (
                  <Pressable key={q} accessibilityRole="button" onPress={() => send(q)} style={s.chip}>
                    <Text style={s.chipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        }
      />

      <View style={[s.inputBar, { paddingBottom: insets.bottom + 10 }]}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Pergunte ao Pomo.ai"
          placeholderTextColor={colors.mute}
          maxLength={1000}
          multiline
          accessibilityLabel="Mensagem para o Pomo.ai"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          disabled={busy || !input.trim()}
          onPress={() => send(input)}
          style={[s.send, (busy || !input.trim()) && { opacity: 0.4 }]}
        >
          <Icon name="send" color={colors.ink} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.5, color: colors.ink },
  list: { padding: 20, gap: 12 },
  bubble: { maxWidth: '85%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.lg },
  me: { backgroundColor: colors.ink, borderBottomRightRadius: 6 },
  model: { backgroundColor: colors.card, borderBottomLeftRadius: 6 },
  msgText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mute },
  chips: { gap: 8, alignItems: 'flex-start' },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  retry: { paddingHorizontal: 16, height: 38, borderRadius: 19, backgroundColor: colors.ink, justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodyBold, fontSize: 14, color: '#fff' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.card },
  input: { flex: 1, maxHeight: 120, minHeight: 48, borderRadius: 24, backgroundColor: colors.paper, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 13, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.leaf, alignItems: 'center', justifyContent: 'center' },
});
