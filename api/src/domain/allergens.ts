import { escapeRegExp, hasTerm, normalizeText } from './text.js';
import type {
  Allergen,
  AlertReport,
  AllergenAlert,
  Product,
  Profile,
  Restriction,
} from './types.js';

interface Rule {
  /** Tags do Open Food Facts (sem o prefixo de idioma). */
  tags: string[];
  /** Termos em português, sem acento e minúsculos (RDC 727/2022). */
  terms: string[];
}

const MILK_TERMS = [
  'leite', 'soro de leite', 'caseina', 'caseinato', 'manteiga', 'queijo', 'iogurte',
  'creme de leite', 'lactoalbumina', 'lactoglobulina', 'whey', 'requeijao', 'nata',
];
const WHEAT_TERMS = ['trigo', 'farinha de trigo', 'semolina', 'germen de trigo', 'espelta'];
const GLUTEN_TERMS = ['gluten', 'centeio', 'cevada', 'aveia', 'malte', ...WHEAT_TERMS];

const RULES: Record<Allergen, Rule> = {
  leite: { tags: ['milk'], terms: MILK_TERMS },
  lactose: { tags: ['milk'], terms: ['lactose', ...MILK_TERMS] },
  ovo: { tags: ['eggs'], terms: ['ovo', 'ovos', 'albumina', 'clara de ovo', 'gema', 'ovalbumina', 'lisozima'] },
  trigo: { tags: ['wheat'], terms: WHEAT_TERMS },
  gluten: { tags: ['gluten', 'wheat'], terms: GLUTEN_TERMS },
  soja: { tags: ['soybeans'], terms: ['soja', 'lecitina de soja', 'proteina de soja', 'shoyu'] },
  amendoim: { tags: ['peanuts'], terms: ['amendoim'] },
  castanhas: {
    tags: ['nuts'],
    terms: ['castanha', 'castanhas', 'amendoa', 'amendoas', 'avela', 'noz', 'nozes', 'pistache', 'macadamia', 'caju', 'pecan', 'castanha do para'],
  },
  peixe: { tags: ['fish'], terms: ['peixe', 'atum', 'sardinha', 'salmao', 'bacalhau', 'anchova', 'tilapia'] },
  crustaceos: { tags: ['crustaceans'], terms: ['crustaceo', 'crustaceos', 'camarao', 'caranguejo', 'lagosta', 'siri'] },
};

const ALLERGEN_LABEL: Record<Allergen, string> = {
  leite: 'leite',
  lactose: 'lactose',
  ovo: 'ovo',
  trigo: 'trigo',
  gluten: 'glúten',
  soja: 'soja',
  amendoim: 'amendoim',
  castanhas: 'castanhas',
  peixe: 'peixe',
  crustaceos: 'crustáceos',
};

const MEAT_TERMS = [
  'carne', 'frango', 'boi', 'bovina', 'bovino', 'suina', 'suino', 'porco', 'bacon', 'presunto',
  'linguica', 'salsicha', 'mortadela', 'peru', 'gelatina', 'banha', 'colageno', 'carmim',
  'cochonilha', 'peixe', 'atum', 'sardinha', 'salmao', 'camarao', 'lula', 'polvo', 'mexilhao', 'ostra',
];
const VEGAN_EXTRA_TERMS = [...MILK_TERMS, 'ovo', 'ovos', 'albumina', 'clara de ovo', 'gema', 'mel'];

const RESTRICTION_RULES: Record<Restriction, { tags: string[]; terms: string[] }> = {
  vegetariano: { tags: ['fish', 'crustaceans', 'molluscs'], terms: MEAT_TERMS },
  vegano: { tags: ['fish', 'crustaceans', 'molluscs', 'milk', 'eggs'], terms: [...MEAT_TERMS, ...VEGAN_EXTRA_TERMS] },
};

/** Expressões que contêm o termo mas não indicam presença do alérgeno. */
const FALSE_POSITIVE_PHRASES = [
  'leite de coco', 'manteiga de cacau', 'noz moscada', 'noz-moscada', 'manteiga de karite',
  'nao contem gluten', 'sem gluten', 'livre de gluten', 'isento de gluten', 'zero gluten',
];

const NOTICE_INCOMPLETE = 'Dados incompletos: confira o rótulo';
const NOTICE_USER = 'dados enviados por usuário, confira o rótulo';

function tagName(tag: string): string {
  return tag.trim().toLowerCase().replace(/^[a-z]{2}:/, '');
}

function cleaned(text: string): string {
  let t = normalizeText(text);
  for (const phrase of FALSE_POSITIVE_PHRASES) {
    t = t.replace(new RegExp(escapeRegExp(normalizeText(phrase)), 'g'), ' ');
  }
  return t;
}

/** Separa o texto em trecho "contém" e trecho "pode conter" (traços). */
function splitTraces(text: string): { contains: string; traces: string } {
  const idx = text.indexOf('pode conter');
  if (idx === -1) return { contains: text, traces: '' };
  const rest = text.slice(idx);
  const end = rest.indexOf('.');
  const traces = end === -1 ? rest : rest.slice(0, end);
  const contains = text.slice(0, idx) + (end === -1 ? '' : rest.slice(end));
  return { contains, traces };
}

function firstMatch(text: string, terms: string[]): string | undefined {
  return terms.find((t) => hasTerm(text, t));
}

export function detectAlerts(product: Product, profile: Profile): AlertReport {
  const hasIngredients = !!product.ingredientsText && product.ingredientsText.trim() !== '';
  const hasAllergenTags = product.allergensTags.length > 0;
  const dataComplete = hasIngredients || hasAllergenTags;

  const { contains, traces } = splitTraces(cleaned(product.ingredientsText ?? ''));
  const containsTags = new Set(product.allergensTags.map(tagName));
  const traceTags = new Set(product.tracesTags.map(tagName));

  const alerts: AllergenAlert[] = [];

  const evaluate = (
    kind: AllergenAlert['kind'],
    item: string,
    rule: { tags: string[]; terms: string[] },
  ): void => {
    const tagContains = rule.tags.find((t) => containsTags.has(t));
    const termContains = firstMatch(contains, rule.terms);
    if (tagContains || termContains) {
      alerts.push({
        kind,
        item,
        level: 'contem',
        reason: termContains
          ? `Contém ${item} (ingrediente: ${termContains})`
          : `Contém ${item} (informado nos alérgenos do produto)`,
      });
      return;
    }
    const tagTrace = rule.tags.find((t) => traceTags.has(t));
    const termTrace = firstMatch(traces, rule.terms);
    if (tagTrace || termTrace) {
      alerts.push({ kind, item, level: 'pode_conter', reason: `Pode conter ${item}` });
    }
  };

  for (const allergen of profile.allergens) {
    evaluate('allergen', ALLERGEN_LABEL[allergen], RULES[allergen]);
  }
  for (const restriction of profile.restrictions) {
    const rule = RESTRICTION_RULES[restriction];
    const termHit = firstMatch(contains, rule.terms);
    const tagHit = rule.tags.find((t) => containsTags.has(t));
    if (termHit || tagHit) {
      alerts.push({
        kind: 'restriction',
        item: restriction,
        level: 'contem',
        reason: `Ingrediente de origem animal${termHit ? `: ${termHit}` : ''}`,
      });
    }
  }

  const notices: string[] = [];
  if (!dataComplete) notices.push(NOTICE_INCOMPLETE);
  // Dado de usuário, ou produto do OFF que o usuário completou com foto: sempre avisar.
  if (!product.verified) notices.push(NOTICE_USER);

  return {
    alerts,
    dataComplete,
    ...(notices.length > 0 ? { notice: notices.join('. ') } : {}),
  };
}
