/**
 * Normaliza código de barras para EAN-13 (UPC-A ganha "0" à frente;
 * EAN-8 permanece com 8 dígitos). Retorna null se inválido.
 */
export function normalizeBarcode(raw: string): string | null {
  const code = raw.trim();
  if (!/^\d+$/.test(code)) return null;
  if (![8, 12, 13].includes(code.length)) return null;
  if (!hasValidCheckDigit(code)) return null;
  return code.length === 12 ? `0${code}` : code;
}

/** Dígito verificador GS1: pesos 1,3,1,3… da direita para a esquerda. */
function hasValidCheckDigit(code: string): boolean {
  let total = 0;
  const digits = [...code].reverse();
  for (let i = 0; i < digits.length; i++) {
    total += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return total % 10 === 0;
}
