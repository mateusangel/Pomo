import { Redirect } from 'expo-router';

// Destino do deep link pomo://auth-callback depois do login social; a sessão já foi
// trocada pelo AuthProvider, então só precisamos voltar à porta de entrada.
export default function AuthCallback() {
  return <Redirect href="/" />;
}
