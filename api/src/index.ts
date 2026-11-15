import { createClient } from '@supabase/supabase-js';
import { loadConfig } from './config.js';
import { createGeminiChat, createGeminiVision } from './integrations/gemini.js';
import { createOffLookup } from './integrations/off.js';
import { createTokenVerifier } from './plugins/auth.js';
import { createPrismaClient, createPrismaRepositories } from './repositories/prisma.js';
import { buildServer } from './server.js';

const config = loadConfig();

const admin = config.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;
if (!admin) console.warn('SUPABASE_SERVICE_ROLE_KEY ausente: exclusão de conta desativada.');
if (!config.GEMINI_API_KEY) console.warn('GEMINI_API_KEY ausente: Pomo.ai (chat) desativado.');

const app = buildServer({
  corsOrigin: config.CORS_ORIGIN,
  deps: {
    repos: createPrismaRepositories(createPrismaClient(config.DATABASE_URL)),
    off: createOffLookup(),
    verifyToken: createTokenVerifier({
      supabaseUrl: config.SUPABASE_URL,
      ...(config.SUPABASE_JWT_SECRET ? { jwtSecret: config.SUPABASE_JWT_SECRET } : {}),
    }),
    ...(config.GEMINI_API_KEY
      ? {
          chat: createGeminiChat({
            apiKey: config.GEMINI_API_KEY,
            ...(config.GEMINI_MODEL ? { model: config.GEMINI_MODEL } : {}),
          }),
          vision: createGeminiVision({
            apiKey: config.GEMINI_API_KEY,
            ...(config.GEMINI_MODEL ? { model: config.GEMINI_MODEL } : {}),
          }),
        }
      : {}),
    ...(admin
      ? {
          deleteUser: async (userId: string) => {
            const { error } = await admin.auth.admin.deleteUser(userId);
            if (error) throw new Error(`falha ao excluir usuário: ${error.message}`);
          },
        }
      : {}),
  },
});

app.listen({ port: config.PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
