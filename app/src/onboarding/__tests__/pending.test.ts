import { parsePending } from '../pending';

describe('parsePending', () => {
  it('devolve null para vazio ou JSON inválido', () => {
    expect(parsePending(null)).toBeNull();
    expect(parsePending('')).toBeNull();
    expect(parsePending('{quebrado')).toBeNull();
    expect(parsePending(JSON.stringify({ name: 'Ana' }))).toBeNull();
  });

  it('lê as respostas do onboarding', () => {
    const raw = JSON.stringify({
      name: 'Ana',
      consent: true,
      profile: { goals: ['Controlar açúcar'], allergens: ['leite'], restrictions: ['vegana'], lessSugar: true, lessSodium: false },
    });
    expect(parsePending(raw)).toEqual({
      name: 'Ana',
      consent: true,
      profile: { goals: ['Controlar açúcar'], allergens: ['leite'], restrictions: ['vegana'], lessSugar: true, lessSodium: false },
    });
  });

  it('ignora valores com tipo errado e nunca assume consentimento', () => {
    const raw = JSON.stringify({
      name: 42,
      consent: 'sim',
      profile: { goals: ['ok', 7, null], allergens: 'leite', restrictions: [], lessSugar: 'x' },
    });
    expect(parsePending(raw)).toEqual({
      name: '',
      consent: false,
      profile: { goals: ['ok'], allergens: [], restrictions: [], lessSugar: false, lessSodium: false },
    });
  });
});
