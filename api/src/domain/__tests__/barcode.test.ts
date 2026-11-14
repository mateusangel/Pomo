import { describe, expect, it } from 'vitest';
import { normalizeBarcode } from '../barcode.js';

describe('normalizeBarcode', () => {
  it('EAN-13 válido volta igual', () => {
    expect(normalizeBarcode('7891000100103')).toBe('7891000100103');
  });
  it('UPC-A de 12 dígitos vira EAN-13 com 0', () => {
    expect(normalizeBarcode('036000291452')).toBe('0036000291452');
  });
  it('EAN-8 válido permanece com 8 dígitos', () => {
    expect(normalizeBarcode('96385074')).toBe('96385074');
  });
  it('UPC-A e EAN-13 com zero à esquerda dão o mesmo código', () => {
    expect(normalizeBarcode('036000291452')).toBe(normalizeBarcode('0036000291452'));
  });
  it('dígito verificador errado → null', () => {
    expect(normalizeBarcode('7891000100104')).toBeNull();
  });
  it('lixo, vazio e 14 dígitos → null', () => {
    expect(normalizeBarcode('abc')).toBeNull();
    expect(normalizeBarcode('')).toBeNull();
    expect(normalizeBarcode('78910001001030')).toBeNull();
  });
  it('remove espaços ao redor', () => {
    expect(normalizeBarcode('  7891000100103 ')).toBe('7891000100103');
  });
});
