import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** `sub` do JWT do Supabase; única fonte de identidade do usuário. */
    userId: string;
  }
}

/** Valida o token e devolve o user_id; lança se inválido. */
export type TokenVerifier = (token: string) => Promise<string>;

export interface VerifierOptions {
  /** Segredo HS256 (projetos legados do Supabase). */
  jwtSecret?: string;
  /** URL do projeto; usada para buscar o JWKS (chaves assimétricas). */
  supabaseUrl?: string;
}

export function createTokenVerifier(opts: VerifierOptions): TokenVerifier {
  const jwks = opts.supabaseUrl
    ? createRemoteJWKSet(new URL(`${opts.supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`))
    : undefined;

  return async (token) => {
    const { alg } = decodeProtectedHeader(token);
    const options = { audience: 'authenticated' } as const;

    let payload;
    if (alg === 'HS256') {
      if (!opts.jwtSecret) throw new Error('segredo HS256 não configurado');
      ({ payload } = await jwtVerify(token, new TextEncoder().encode(opts.jwtSecret), {
        ...options,
        algorithms: ['HS256'],
      }));
    } else {
      if (!jwks) throw new Error('JWKS não configurado');
      ({ payload } = await jwtVerify(token, jwks, options));
    }

    if (!payload.sub) throw new Error('token sem sub');
    return payload.sub;
  };
}

/** preHandler: exige `Authorization: Bearer <jwt>` e preenche request.userId. */
export function requireAuth(verify: TokenVerifier) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return void reply.code(401).send({ error: 'unauthorized' });
    try {
      request.userId = await verify(token);
    } catch {
      return void reply.code(401).send({ error: 'unauthorized' });
    }
  };
}
