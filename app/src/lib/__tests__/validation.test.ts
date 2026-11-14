import { checkPassword, isEmail } from '../validation';

describe('isEmail', () => {
  it('aceita e-mails comuns e ignora espaços nas pontas', () => {
    expect(isEmail('ana@exemplo.com.br')).toBe(true);
    expect(isEmail('  ana@exemplo.com ')).toBe(true);
  });
  it('rejeita formatos inválidos', () => {
    for (const v of ['', 'ana', 'ana@', 'ana@exemplo', 'ana @exemplo.com', '@exemplo.com']) expect(isEmail(v)).toBe(false);
  });
});

describe('checkPassword', () => {
  it('exige 8+ caracteres com letra e número', () => {
    expect(checkPassword('abc123').valid).toBe(false);
    expect(checkPassword('abcdefgh').valid).toBe(false);
    expect(checkPassword('12345678').valid).toBe(false);
    expect(checkPassword('abcd1234').valid).toBe(true);
  });
  it('gradua a força', () => {
    expect(checkPassword('abcd1234').level).toBe(1);
    expect(checkPassword('Abcd1234').level).toBe(2);
    expect(checkPassword('Abcd1234!xyz').level).toBe(3);
  });
});
