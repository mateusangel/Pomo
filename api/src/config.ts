import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().default(3333),
  CORS_ORIGIN: z.string().default('*'),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),
  DATABASE_URL: z.string().min(1),
});

export type Config = z.infer<typeof schema>;

/** Valida o ambiente; falha com mensagem clara listando só os NOMES faltantes. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Apelidos do .env local: PROJECT = URL do Supabase, GEMINI = chave do Gemini.
  const merged = {
    ...env,
    SUPABASE_URL: env.SUPABASE_URL ?? env.PROJECT,
    GEMINI_API_KEY: env.GEMINI_API_KEY ?? env.GEMINI,
  };
  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Variáveis de ambiente inválidas ou ausentes: ${names}`);
  }
  return parsed.data;
}
