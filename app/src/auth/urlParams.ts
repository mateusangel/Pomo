/** Lê os parâmetros do fragmento (#...) de uma URL de retorno (ex.: pomo://auth-callback#error=...). */
export function fragmentParams(url: string): Record<string, string> {
  const hash = url.indexOf('#');
  if (hash < 0) return {};
  const out: Record<string, string> = {};
  new URLSearchParams(url.slice(hash + 1)).forEach((value, key) => {
    out[key] = value;
  });
  return out;
}
