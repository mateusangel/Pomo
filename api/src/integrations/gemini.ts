export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

/** Gera a resposta do Pomo.ai. Lança em falha do provedor. */
export type ChatModel = (input: { system: string; turns: ChatTurn[] }) => Promise<string>;

export interface ImageInput {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Base64 sem prefixo data:. */
  data: string;
}

/** Lê imagens e devolve texto (JSON, quando pedido). Lança em falha do provedor. */
export type VisionModel = (input: { system: string; prompt: string; images: ImageInput[] }) => Promise<string>;

export interface GeminiOptions {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GenerateRequest {
  system: string;
  contents: { role: 'user' | 'model'; parts: Part[] }[];
  generationConfig: Record<string, unknown>;
}

/** Chamada única ao generateContent do Gemini; devolve o texto da primeira resposta. */
async function generate(opts: GeminiOptions, body: GenerateRequest, timeoutMs: number): Promise<string> {
  const model = opts.model ?? DEFAULT_GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const doFetch = opts.fetchImpl ?? fetch;

  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': opts.apiKey },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: body.system }] },
      contents: body.contents,
      generationConfig: body.generationConfig,
    }),
  });
  if (!res.ok) throw new Error(`gemini HTTP ${res.status}`);
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
  if (!text) throw new Error('gemini sem resposta');
  return text;
}

export function createGeminiChat(opts: GeminiOptions): ChatModel {
  return async ({ system, turns }) =>
    generate(
      opts,
      {
        system,
        contents: turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
        generationConfig: { temperature: 0.6, maxOutputTokens: 700 },
      },
      opts.timeoutMs ?? 30_000,
    );
}

/** Leitura de rótulo: imagens + instrução, resposta em JSON, temperatura baixa para não inventar. */
export function createGeminiVision(opts: GeminiOptions): VisionModel {
  return async ({ system, prompt, images }) =>
    generate(
      opts,
      {
        system,
        contents: [
          {
            role: 'user',
            parts: [
              ...images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
              { text: prompt },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1200, responseMimeType: 'application/json' },
      },
      opts.timeoutMs ?? 45_000,
    );
}
