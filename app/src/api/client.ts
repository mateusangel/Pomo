import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import type {
  AlternativesResponse,
  ChatMessage,
  CompareResponse,
  ExplainRequest,
  FavoriteItem,
  HistoryItem,
  LabelImage,
  ProductAnalysis,
  ProfileData,
  ProfileResponse,
  StatsSummary,
} from './types';

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // Em desenvolvimento, usa o mesmo computador que serve o Expo (IP da rede local).
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host ?? 'localhost'}:3333`;
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(`API ${status} ${code}`);
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Servidor gratuito do Render dorme e leva até ~1 min para acordar: falhas de rede e 502/503/504 merecem nova tentativa. */
const RETRY_DELAYS_MS = [2000, 5000];
const isTransient = (status: number) => status === 502 || status === 503 || status === 504;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  // Só repete leituras (GET) e a escrita idempotente de favoritos; nunca POST (scan, chat, rótulo).
  const retryable = method === 'GET' || method === 'DELETE' || (method === 'PUT' && path.startsWith('/v1/favorites'));

  let res: Response | null = null;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
      if (!(retryable && isTransient(res.status) && attempt < RETRY_DELAYS_MS.length)) break;
    } catch {
      if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw new ApiError(0, 'network');
    }
    await sleep(RETRY_DELAYS_MS[attempt]!);
  }
  if (!res) throw new ApiError(0, 'network');
  if (res.status === 204) return undefined as T;
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, json.error ?? 'unknown');
  return json as T;
}

export const api = {
  scan: (barcode: string) => request<ProductAnalysis>('POST', '/v1/scans', { barcode }),
  product: (barcode: string) => request<ProductAnalysis>('GET', `/v1/products/${encodeURIComponent(barcode)}`),
  search: (q: string) => request<{ results: ProductAnalysis[] }>('GET', `/v1/products/search?q=${encodeURIComponent(q)}`),
  history: () => request<{ items: HistoryItem[] }>('GET', '/v1/history'),
  getProfile: () => request<ProfileResponse>('GET', '/v1/profile'),
  putProfile: (profile: ProfileData, consent: boolean) =>
    request<ProfileResponse>('PUT', '/v1/profile', { profile, consent }),
  chat: (messages: ChatMessage[], barcode?: string) =>
    request<{ reply: string }>('POST', '/v1/chat', { messages, ...(barcode ? { barcode } : {}) }),
  alternatives: (barcode: string) =>
    request<AlternativesResponse>('GET', `/v1/products/${encodeURIComponent(barcode)}/alternatives`),
  compare: (barcodes: string[]) =>
    request<CompareResponse>('GET', `/v1/compare?barcodes=${encodeURIComponent(barcodes.join(','))}`),
  readLabel: (images: LabelImage[], barcode?: string) =>
    request<ProductAnalysis>('POST', '/v1/labels', { images, ...(barcode ? { barcode } : {}) }),
  stats: (days = 30) => request<StatsSummary>('GET', `/v1/stats?days=${days}`),
  favorites: () => request<{ items: FavoriteItem[] }>('GET', '/v1/favorites'),
  addFavorite: (barcode: string) => request<void>('PUT', `/v1/favorites/${encodeURIComponent(barcode)}`),
  removeFavorite: (barcode: string) => request<void>('DELETE', `/v1/favorites/${encodeURIComponent(barcode)}`),
  explain: (input: ExplainRequest) => request<{ module: string; reply: string }>('POST', '/v1/ai/explain', input),
  deleteAccount: () => request<void>('DELETE', '/v1/account'),
};
