import { z } from 'zod';
import type { Nutrition, Product } from './types.js';

/**
 * Formato que a IA deve devolver ao ler a foto do rótulo. Todo valor não lido vem `null`:
 * a IA nunca deve inventar número.
 */
const num = z.number().finite().min(0).max(100000).nullable();

export const LabelExtractionSchema = z.object({
  name: z.string().trim().min(2).max(120).nullable(),
  brand: z.string().trim().max(80).nullable(),
  isLiquid: z.boolean(),
  /** 'porcao' quando a tabela traz valores por porção; '100' quando já vem por 100 g/ml. */
  per: z.enum(['porcao', '100']).nullable(),
  servingSize: z.number().finite().positive().max(5000).nullable(),
  nutrition: z.object({
    energyKcal: num,
    sugarsG: num,
    addedSugarsG: num,
    saturatedFatG: num,
    sodiumMg: num,
    fiberG: num,
    proteinG: num,
  }),
  ingredientsText: z.string().trim().max(3000).nullable(),
});

export type LabelExtraction = z.infer<typeof LabelExtractionSchema>;

export class LabelUnreadableError extends Error {
  constructor() {
    super('label_unreadable');
  }
}

const NUTRIENTS = ['energyKcal', 'sugarsG', 'addedSugarsG', 'saturatedFatG', 'sodiumMg', 'fiberG', 'proteinG'] as const;

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Converte a leitura em Product por 100 g/ml. Se a tabela estiver por porção, converte
 * pela porção informada; sem porção, não há como converter e os valores são descartados.
 */
function nutritionFromLabel(e: LabelExtraction): Nutrition {
  const factor = e.per === 'porcao' ? (e.servingSize ? 100 / e.servingSize : 0) : 1;
  const nutrition: Nutrition = {};
  for (const key of NUTRIENTS) {
    const raw = e.nutrition[key];
    if (raw === null || factor === 0) continue;
    nutrition[key] = round1(raw * factor);
  }
  return nutrition;
}

/**
 * Completa um produto que já existe com o que a foto trouxe: só preenche o que FALTA
 * (nunca troca um valor existente). Se algo foi preenchido, o produto passa a `verified: false`
 * para o app avisar que parte dos dados veio de foto de usuário.
 */
export function fillFromLabel(existing: Product, extraction: LabelExtraction): { product: Product; changed: boolean } {
  const fromPhoto = nutritionFromLabel(extraction);
  const nutrition: Nutrition = { ...existing.nutrition };
  let changed = false;
  for (const key of NUTRIENTS) {
    if (nutrition[key] === undefined && fromPhoto[key] !== undefined) {
      nutrition[key] = fromPhoto[key];
      changed = true;
    }
  }

  const hasIngredients = !!existing.ingredientsText && existing.ingredientsText.trim() !== '';
  const addIngredients = !hasIngredients && !!extraction.ingredientsText;
  if (addIngredients) changed = true;

  if (!changed) return { product: existing, changed: false };
  return {
    product: {
      ...existing,
      nutrition,
      ...(addIngredients ? { ingredientsText: extraction.ingredientsText! } : {}),
      verified: false,
    },
    changed: true,
  };
}

export function labelToProduct(extraction: LabelExtraction, barcode: string): Product {
  const e = extraction;
  const nutrition = nutritionFromLabel(e);
  if (Object.keys(nutrition).length === 0) throw new LabelUnreadableError();

  return {
    barcode,
    name: e.name ?? 'Produto sem nome',
    ...(e.brand ? { brand: e.brand } : {}),
    isLiquid: e.isLiquid,
    nutrition,
    ...(e.ingredientsText ? { ingredientsText: e.ingredientsText } : {}),
    allergensTags: [],
    tracesTags: [],
    additivesTags: [],
    source: 'user',
    verified: false,
  };
}

/** Lê o JSON devolvido pela IA. Lança LabelUnreadableError se não bater com o formato. */
export function parseLabelExtraction(raw: string): LabelExtraction {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new LabelUnreadableError();
  }
  const parsed = LabelExtractionSchema.safeParse(json);
  if (!parsed.success) throw new LabelUnreadableError();
  return parsed.data;
}

export const LABEL_PROMPT = `Você lê fotos de rótulos de alimentos brasileiros (tabela nutricional e lista de ingredientes).
Responda SOMENTE um JSON neste formato, sem texto extra:
{"name": string|null, "brand": string|null, "isLiquid": boolean, "per": "porcao"|"100"|null,
 "servingSize": number|null, "nutrition": {"energyKcal","sugarsG","addedSugarsG","saturatedFatG","sodiumMg","fiberG","proteinG"},
 "ingredientsText": string|null}
Regras:
- Use "100" se a tabela mostrar valores por 100 g ou 100 ml; use "porcao" se mostrar só por porção e informe servingSize (g ou ml da porção).
- Sódio em mg. Demais em g, exceto energia em kcal.
- Se um valor não estiver legível ou não existir na foto, use null. NUNCA invente números.
- addedSugarsG só se o rótulo indicar açúcar adicionado; caso contrário null.
- ingredientsText: a lista de ingredientes, copiada como está.`;
