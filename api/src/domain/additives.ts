import { hasTerm, normalizeText } from './text.js';
import type { AdditiveInfo, Product } from './types.js';

interface Entry extends AdditiveInfo {
  /** Nomes alternativos (já sem acento, minúsculos). */
  aliases: string[];
}

const EFSA = 'EFSA (Autoridade Europeia para a Segurança dos Alimentos)';
const JECFA = 'JECFA (FAO/OMS)';
const ANVISA = 'ANVISA (RDC 778/2023)';

const DICTIONARY: Entry[] = [
  { code: 'E102', name: 'Tartrazina', category: 'corante', penalty: 6, aliases: ['tartrazina'], explanation: 'Corante amarelo sintético. Pode causar reações em pessoas sensíveis e deve ser declarado no rótulo.', source: ANVISA },
  { code: 'E110', name: 'Amarelo crepúsculo', category: 'corante', penalty: 6, aliases: ['amarelo crepusculo', 'amarelo sunset'], explanation: 'Corante alaranjado sintético. A EFSA reavaliou a dose diária aceitável e a manteve baixa.', source: EFSA },
  { code: 'E122', name: 'Azorrubina', category: 'corante', penalty: 5, aliases: ['azorrubina', 'carmoisina'], explanation: 'Corante vermelho sintético associado a sensibilidade em algumas pessoas.', source: EFSA },
  { code: 'E124', name: 'Ponceau 4R', category: 'corante', penalty: 5, aliases: ['ponceau 4r', 'vermelho cochonilha a'], explanation: 'Corante vermelho sintético com dose diária aceitável reduzida pela EFSA.', source: EFSA },
  { code: 'E129', name: 'Vermelho 40', category: 'corante', penalty: 5, aliases: ['vermelho 40', 'vermelho allura'], explanation: 'Corante vermelho sintético muito comum em balas, bebidas e doces.', source: JECFA },
  { code: 'E133', name: 'Azul brilhante', category: 'corante', penalty: 3, aliases: ['azul brilhante'], explanation: 'Corante azul sintético com baixa absorção pelo organismo.', source: JECFA },
  { code: 'E150D', name: 'Caramelo IV', category: 'corante', penalty: 3, aliases: ['caramelo iv', 'corante caramelo iv', 'corante caramelo'], explanation: 'Corante marrom presente em refrigerantes e molhos. Pode conter traços de 4-MEI, composto monitorado.', source: EFSA },
  { code: 'E160B', name: 'Urucum', category: 'corante', penalty: 1, aliases: ['urucum', 'bixina', 'norbixina'], explanation: 'Corante natural extraído da semente do urucuzeiro; pode causar reação em pessoas muito sensíveis.', source: EFSA },
  { code: 'E171', name: 'Dióxido de titânio', category: 'corante', penalty: 8, aliases: ['dioxido de titanio'], explanation: 'Corante branco. A União Europeia proibiu o uso em alimentos em 2022 por incerteza sobre segurança.', source: EFSA },
  { code: 'E202', name: 'Sorbato de potássio', category: 'conservante', penalty: 2, aliases: ['sorbato de potassio'], explanation: 'Conservante comum, de baixo risco nas doses usadas.', source: JECFA },
  { code: 'E211', name: 'Benzoato de sódio', category: 'conservante', penalty: 5, aliases: ['benzoato de sodio'], explanation: 'Conservante usado em refrigerantes e molhos. Em combinação com vitamina C pode formar benzeno.', source: EFSA },
  { code: 'E212', name: 'Benzoato de potássio', category: 'conservante', penalty: 5, aliases: ['benzoato de potassio'], explanation: 'Conservante semelhante ao benzoato de sódio.', source: EFSA },
  { code: 'E220', name: 'Dióxido de enxofre', category: 'conservante', penalty: 4, aliases: ['dioxido de enxofre', 'anidrido sulfuroso'], explanation: 'Conservante que pode desencadear crise em pessoas com asma ou sensibilidade a sulfitos.', source: ANVISA },
  { code: 'E250', name: 'Nitrito de sódio', category: 'conservante', penalty: 8, aliases: ['nitrito de sodio'], explanation: 'Conservante de embutidos. Pode formar nitrosaminas; a OMS associa carnes processadas a maior risco de câncer.', source: EFSA },
  { code: 'E251', name: 'Nitrato de sódio', category: 'conservante', penalty: 6, aliases: ['nitrato de sodio'], explanation: 'Conservante de embutidos que se converte em nitrito no organismo.', source: EFSA },
  { code: 'E320', name: 'BHA', category: 'conservante', penalty: 6, aliases: ['bha', 'butil hidroxianisol', 'butilhidroxianisol'], explanation: 'Antioxidante sintético para gorduras, com uso limitado por dúvidas sobre efeitos de longo prazo.', source: EFSA },
  { code: 'E321', name: 'BHT', category: 'conservante', penalty: 5, aliases: ['bht', 'butil hidroxitolueno', 'butilhidroxitolueno'], explanation: 'Antioxidante sintético usado em salgadinhos e óleos.', source: EFSA },
  { code: 'E330', name: 'Ácido cítrico', category: 'outro', penalty: 0, aliases: ['acido citrico'], explanation: 'Acidulante comum, presente naturalmente em frutas cítricas. Considerado seguro.', source: JECFA },
  { code: 'E322', name: 'Lecitina', category: 'outro', penalty: 0, aliases: ['lecitina', 'lecitina de soja'], explanation: 'Emulsificante de origem vegetal. Quando de soja, pode alertar quem tem alergia a soja.', source: JECFA },
  { code: 'E407', name: 'Carragena', category: 'outro', penalty: 3, aliases: ['carragena', 'carragenina'], explanation: 'Espessante extraído de algas; há debate sobre efeitos intestinais em doses altas.', source: EFSA },
  { code: 'E415', name: 'Goma xantana', category: 'outro', penalty: 0, aliases: ['goma xantana'], explanation: 'Espessante bem tolerado nas quantidades usadas.', source: JECFA },
  { code: 'E450', name: 'Difosfatos', category: 'outro', penalty: 3, aliases: ['difosfato', 'pirofosfato'], explanation: 'Fosfatos adicionados em excesso podem sobrecarregar os rins de quem tem doença renal.', source: EFSA },
  { code: 'E452', name: 'Polifosfatos', category: 'outro', penalty: 3, aliases: ['polifosfato'], explanation: 'Fosfatos usados em embutidos; atenção para quem tem doença renal.', source: EFSA },
  { code: 'E471', name: 'Mono e diglicerídeos de ácidos graxos', category: 'outro', penalty: 1, aliases: ['mono e diglicerideos', 'monoglicerideos', 'diglicerideos'], explanation: 'Emulsificante comum em pães e biscoitos.', source: JECFA },
  { code: 'E621', name: 'Glutamato monossódico', category: 'realcador', penalty: 4, aliases: ['glutamato monossodico', 'glutamato de sodio'], explanation: 'Realçador de sabor que também aumenta o sódio do produto; pode causar sintomas em pessoas sensíveis.', source: EFSA },
  { code: 'E631', name: 'Inosinato dissódico', category: 'realcador', penalty: 3, aliases: ['inosinato dissodico'], explanation: 'Realçador de sabor usado junto com o glutamato.', source: EFSA },
  { code: 'E950', name: 'Acessulfame de potássio', category: 'adocante', penalty: 4, aliases: ['acessulfame de potassio', 'acessulfame k', 'acesulfame k', 'acessulfame'], explanation: 'Adoçante artificial sem calorias, muito mais doce que o açúcar.', source: JECFA },
  { code: 'E951', name: 'Aspartame', category: 'adocante', penalty: 5, aliases: ['aspartame'], explanation: 'Adoçante artificial. Deve ser evitado por quem tem fenilcetonúria. A dose diária aceitável é de 40 mg/kg.', source: EFSA },
  { code: 'E952', name: 'Ciclamato', category: 'adocante', penalty: 5, aliases: ['ciclamato', 'ciclamato de sodio'], explanation: 'Adoçante artificial sem calorias; tem limite diário de consumo definido.', source: JECFA },
  { code: 'E954', name: 'Sacarina', category: 'adocante', penalty: 4, aliases: ['sacarina'], explanation: 'Adoçante artificial sem calorias, com gosto residual metálico.', source: JECFA },
  { code: 'E955', name: 'Sucralose', category: 'adocante', penalty: 4, aliases: ['sucralose'], explanation: 'Adoçante artificial sem calorias derivado do açúcar.', source: JECFA },
  { code: 'E960', name: 'Glicosídeos de esteviol', category: 'adocante', penalty: 2, aliases: ['glicosideos de esteviol', 'esteviosideo', 'steviol', 'estevia'], explanation: 'Adoçante de origem vegetal (estévia) sem calorias.', source: JECFA },
];

const BY_CODE = new Map(DICTIONARY.map((e) => [e.code, e]));

function toInfo({ aliases: _aliases, ...info }: Entry): AdditiveInfo {
  return info;
}

/** Códigos E/INS citados no texto já normalizado. */
function codesInText(text: string): string[] {
  const found: string[] = [];
  for (const m of text.matchAll(/(?<![a-z0-9])(?:ins\s?-?|e-?)(\d{3,4}[a-z]?)(?![a-z0-9])/g)) {
    found.push(`E${m[1]!.toUpperCase()}`);
  }
  return found;
}

export function detectAdditives(
  product: Pick<Product, 'ingredientsText' | 'additivesTags'>,
): AdditiveInfo[] {
  const codes = new Set<string>();

  for (const tag of product.additivesTags) {
    const m = /^(?:[a-z]{2}:)?e(\d{3,4}[a-z]?)$/i.exec(tag.trim());
    if (m) codes.add(`E${m[1]!.toUpperCase()}`);
  }

  const text = normalizeText(product.ingredientsText ?? '');
  for (const code of codesInText(text)) codes.add(code);
  for (const entry of DICTIONARY) {
    if (entry.aliases.some((a) => hasTerm(text, a))) codes.add(entry.code);
  }

  return [...codes]
    .map((c) => BY_CODE.get(c))
    .filter((e): e is Entry => e !== undefined)
    .map(toInfo);
}

export function additivePenalty(found: AdditiveInfo[]): number {
  return Math.min(20, found.reduce((sum, a) => sum + a.penalty, 0));
}

export const ADDITIVE_DICTIONARY: readonly AdditiveInfo[] = DICTIONARY.map(toInfo);
