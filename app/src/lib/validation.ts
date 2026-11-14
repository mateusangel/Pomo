export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export interface PasswordCheck {
  /** 0 = vazia/fraca, 1 = ok, 2 = boa, 3 = forte */
  level: 0 | 1 | 2 | 3;
  valid: boolean;
  label: string;
}

/** Mínimo: 8 caracteres com letra e número (alinhado ao que mostramos no cadastro). */
export function checkPassword(value: string): PasswordCheck {
  const long = value.length >= 8;
  const hasLetter = /[A-Za-zÀ-ÿ]/.test(value);
  const hasDigit = /\d/.test(value);
  const valid = long && hasLetter && hasDigit;
  if (!valid) return { level: 0, valid, label: 'Fraca' };
  const extras = Number(value.length >= 12) + Number(/[^A-Za-z0-9À-ÿ]/.test(value)) + Number(/[A-Z]/.test(value) && /[a-z]/.test(value));
  if (extras >= 2) return { level: 3, valid, label: 'Forte' };
  if (extras === 1) return { level: 2, valid, label: 'Boa' };
  return { level: 1, valid, label: 'Ok' };
}
