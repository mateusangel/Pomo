import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import { registerV1Routes, type Deps } from './routes/v1.js';

export interface ServerOptions {
  corsOrigin?: string;
  /** Sem deps, sobe só o /health (usado em testes de infraestrutura). */
  deps?: Deps;
  logger?: boolean;
}

/** Monta o servidor sem abrir porta (testável com app.inject). */
export function buildServer(opts: ServerOptions = {}): FastifyInstance {
  const app = Fastify({
    // Nunca registrar JWT, perfil de saúde ou alergias.
    logger: opts.logger === false ? false : { redact: ['req.headers.authorization'] },
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(cors, { origin: opts.corsOrigin ?? '*' });
  app.register(rateLimit, { max: 120, timeWindow: '1 minute' });

  app.get('/health', async () => ({ ok: true }));
  // Ping leve para cron externo (mantém o Render acordado); não toca no banco.
  app.get('/ping', async () => ({ ok: true, pong: true }));

  if (opts.deps) registerV1Routes(app, opts.deps);

  app.setErrorHandler((error, request, reply) => {
    const message = error instanceof Error ? error.message : 'desconhecido';
    request.log.error({ err: message }, 'erro não tratado');
    return reply.code(500).send({ error: 'internal_error' });
  });

  return app;
}
