import type { Nutrition, Product } from '../domain/types.js';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function isLiquid(product: Obj): boolean {
  const quantity = str(product.quantity) ?? '';
  if (/\d\s*(ml|cl|l)\b/i.test(quantity)) return true;
  return strArray(product.categories_tags).includes('en:beverages');
}

/** Ingredientes em português; sem eles, qualquer idioma disponível ou a lista estruturada. */
function ingredientsOf(p: Obj): string | undefined {
  const direct = str(p.ingredients_text_pt) ?? str(p.ingredients_text);
  if (direct) return direct;
  for (const [key, value] of Object.entries(p)) {
    if (key.startsWith('ingredients_text_') && str(value)) return str(value);
  }
  if (Array.isArray(p.ingredients)) {
    const texts = p.ingredients.filter(isObj).map((i) => str(i.text)).filter((t): t is string => !!t);
    if (texts.length > 0) return texts.join(', ');
  }
  return undefined;
}

/** Converte a resposta do Open Food Facts em Product; null se não houver produto utilizável. */
export function mapOffProduct(off: unknown, barcode: string): Product | null {
  if (!isObj(off) || off.status === 0 || !isObj(off.product)) return null;
  const p = off.product;

  const name = str(p.product_name_pt) ?? str(p.product_name) ?? str(p.generic_name);
  if (!name) return null;

  const n = isObj(p.nutriments) ? p.nutriments : {};
  const serving = num(p.serving_quantity);

  // Valor por 100 g/ml: usa o campo *_100g; sem ele, converte o valor por porção.
  const per100 = (key: string): number | undefined => {
    const direct = num(n[`${key}_100g`]);
    if (direct !== undefined) return direct;
    const perServing = num(n[`${key}_serving`]);
    if (perServing !== undefined && serving !== undefined && serving > 0) {
      return Math.round(((perServing * 100) / serving) * 1000) / 1000;
    }
    return undefined;
  };

  // OFF entrega sódio em gramas; sem sódio, deriva do sal (sódio ≈ 40% do sal).
  const sodiumG = per100('sodium');
  const saltG = per100('salt');
  const sodiumMg =
    sodiumG !== undefined ? sodiumG * 1000 : saltG !== undefined ? saltG * 400 : undefined;

  // Energia: kcal direto; sem ele, converte de kJ (1 kcal = 4,184 kJ).
  const kcal = per100('energy-kcal');
  const kj = per100('energy-kj') ?? per100('energy');
  const energyKcal = kcal !== undefined ? kcal : kj !== undefined ? Math.round(kj / 4.184) : undefined;

  const nutrition: Nutrition = {};
  const set = <K extends keyof Nutrition>(key: K, value: number | undefined) => {
    if (value !== undefined) nutrition[key] = value;
  };
  set('energyKcal', energyKcal);
  set('sugarsG', per100('sugars'));
  set('addedSugarsG', per100('added-sugars'));
  set('saturatedFatG', per100('saturated-fat'));
  set('sodiumMg', sodiumMg);
  set('fiberG', per100('fiber'));
  set('proteinG', per100('proteins'));

  const brand = str(p.brands)?.split(',')[0]?.trim();
  const category = strArray(p.categories_tags)[0];
  const ingredients = ingredientsOf(p);

  return {
    barcode,
    name,
    ...(brand ? { brand } : {}),
    ...(category ? { category } : {}),
    isLiquid: isLiquid(p),
    nutrition,
    ...(ingredients ? { ingredientsText: ingredients } : {}),
    allergensTags: strArray(p.allergens_tags),
    tracesTags: strArray(p.traces_tags),
    additivesTags: strArray(p.additives_tags),
    source: 'off',
    verified: true,
  };
}

export type OffResult =
  | { kind: 'found'; product: Product }
  | { kind: 'not_found' }
  | { kind: 'error' };

export type OffLookup = (barcode: string) => Promise<OffResult>;

const FIELDS = [
  'code', 'product_name', 'product_name_pt', 'generic_name', 'brands', 'categories_tags', 'quantity',
  'nutriments', 'serving_quantity', 'ingredients_text', 'ingredients_text_pt', 'ingredients_text_en',
  'ingredients_text_es', 'ingredients_text_fr', 'ingredients', 'allergens_tags', 'traces_tags', 'additives_tags',
].join(',');

/** Servidores do OFF, em ordem: se o primeiro falhar ou demorar, tenta o segundo. */
const HOSTS = ['world.openfoodfacts.org', 'br.openfoodfacts.org'];

export function createOffLookup(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): OffLookup {
  return async (barcode) => {
    for (const host of HOSTS) {
      try {
        const res = await fetchImpl(`https://${host}/api/v2/product/${barcode}.json?fields=${FIELDS}`, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { 'User-Agent': 'PomoAI/0.1' },
        });
        if (res.status === 404) return { kind: 'not_found' };
        if (!res.ok) continue;
        const product = mapOffProduct(await res.json(), barcode);
        return product ? { kind: 'found', product } : { kind: 'not_found' };
      } catch {
        // Servidor fora ou lento: tenta o próximo.
      }
    }
    return { kind: 'error' };
  };
}
