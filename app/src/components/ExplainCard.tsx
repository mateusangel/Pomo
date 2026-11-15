import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, ApiError } from '../api/client';
import type { ExplainRequest } from '../api/types';
import { colors, fonts, radius } from '../theme';

function errorText(e: unknown): string {
  const status = e instanceof ApiError ? e.status : 0;
  if (status === 402) return 'A explicação do Pomo.ai faz parte do plano Pomo+.';
  if (status === 429) return 'Muitos pedidos agora. Espere um minutinho e tente de novo.';
  if (status === 503) return 'O Pomo.ai está indisponível no momento.';
  if (status === 502) return 'Não consegui pensar numa resposta agora. Tente de novo.';
  if (status === 400) return 'Ainda não há dados suficientes para explicar.';
  if (status === 404) return 'Esta função ainda não está disponível no servidor. Tente mais tarde.';
  if (status === 401) return 'Sua sessão expirou. Entre novamente.';
  if (status === 0) return 'Sem conexão com o servidor. Verifique sua internet.';
  return 'Algo deu errado. Tente novamente.';
}

/** Renderiza **negrito** simples. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text style={s.text}>
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

/**
 * Botão "Pomo.ai explica": interpreta a tela atual (produto, histórico, evolução, comparação...).
 * O acesso por plano é decidido pela API (402 = precisa do Pomo+); hoje está liberado para todos.
 */
export function ExplainCard({ request, label = 'Pomo.ai, me explica' }: { request: ExplainRequest; label?: string }) {
  const [state, setState] = useState<{ loading: boolean; reply: string | null; error: string | null }>({
    loading: false,
    reply: null,
    error: null,
  });

  const run = async () => {
    if (state.loading) return;
    setState({ loading: true, reply: null, error: null });
    try {
      const res = await api.explain(request);
      setState({ loading: false, reply: res.reply, error: null });
    } catch (e) {
      setState({ loading: false, reply: null, error: errorText(e) });
    }
  };

  return (
    <View style={s.wrap}>
      {state.reply ? (
        <View style={s.card} accessibilityLiveRegion="polite">
          <Text style={s.title}>Pomo.ai explica</Text>
          <Rich text={state.reply} />
          <Text style={s.hint}>Explicação gerada por IA. A nota continua sendo calculada por regras fixas.</Text>
        </View>
      ) : null}
      {state.error ? (
        <View style={[s.card, { backgroundColor: colors.amberSoft }]} accessibilityLiveRegion="polite">
          <Text style={s.text}>{state.error}</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={state.loading}
        onPress={run}
        style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
      >
        {state.loading ? <ActivityIndicator color={colors.ink} /> : null}
        <Text style={s.btnText}>{state.loading ? 'Pensando...' : state.reply ? 'Explicar de novo' : label}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  card: { backgroundColor: colors.leafSoft, borderRadius: radius.md, padding: 16, gap: 8 },
  title: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.leafDeep },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.mute },
  btn: {
    minHeight: 48,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.leafDeep,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.leafDeep },
});
