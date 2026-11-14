import { defineConfig } from 'prisma/config';

// Prisma 7 não carrega .env sozinho.
try {
  process.loadEnvFile('.env');
} catch {
  // sem .env local: variáveis vêm do ambiente
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Migrations usam a conexão direta; o runtime usa DATABASE_URL (pooler).
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '' },
});
