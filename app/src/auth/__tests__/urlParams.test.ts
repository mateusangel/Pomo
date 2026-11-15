import { fragmentParams } from '../urlParams';

describe('fragmentParams', () => {
  it('lê parâmetros do fragmento (#)', () => {
    expect(fragmentParams('pomo://auth-callback#error=access_denied&error_description=Usu%C3%A1rio+cancelou')).toEqual({
      error: 'access_denied',
      error_description: 'Usuário cancelou',
    });
  });
  it('ignora a query e devolve vazio sem fragmento', () => {
    expect(fragmentParams('pomo://auth-callback?code=abc')).toEqual({});
  });
});
