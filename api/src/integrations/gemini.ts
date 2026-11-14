export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

/** Gera a resposta do Pomo.ai. Lança em falha do provedor. */
export type ChatModel = (input: { system: string; turns: ChatTurn[] }) => Promise<string>;

export interface GeminiOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export function createGeminiChat(opts: GeminiOptions): ChatModel {
  const model = opts.model ?? DEFAULT_GEMINI_MODEL;
  const doFetch = opts.fetchImpl ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  return async ({ system, turns }) => {
    const res = await doFetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        generationConfig: { temperature: 0.6, maxOutputTokens: 700 },
      }),
    });
    if (!res.ok) throw new Error(`gemini HTTP ${res.status}`);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
    if (!text) throw new Error('gemini sem resposta');
    return text;
  };
}
