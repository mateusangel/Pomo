-- CreateTable
CREATE TABLE "profiles" (
    "user_id" UUID NOT NULL,
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "restrictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "less_sugar" BOOLEAN NOT NULL DEFAULT false,
    "less_sodium" BOOLEAN NOT NULL DEFAULT false,
    "health_consent_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "products" (
    "barcode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT,
    "is_liquid" BOOLEAN NOT NULL DEFAULT false,
    "nutrition" JSONB NOT NULL DEFAULT '{}',
    "ingredients_text" TEXT,
    "allergens_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "traces_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "additives_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("barcode")
);

-- CreateTable
CREATE TABLE "scan_history" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "barcode" TEXT NOT NULL,
    "scanned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scan_history_user_id_scanned_at_idx" ON "scan_history"("user_id", "scanned_at" DESC);

-- AddForeignKey
ALTER TABLE "scan_history" ADD CONSTRAINT "scan_history_barcode_fkey" FOREIGN KEY ("barcode") REFERENCES "products"("barcode") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===== SQL manual (o Prisma não modela) =====

-- Arrays nunca nulos
ALTER TABLE "profiles" ALTER COLUMN "goals" SET NOT NULL, ALTER COLUMN "allergens" SET NOT NULL, ALTER COLUMN "restrictions" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "allergens_tags" SET NOT NULL, ALTER COLUMN "traces_tags" SET NOT NULL, ALTER COLUMN "additives_tags" SET NOT NULL;

-- Origem do produto
ALTER TABLE "products" ADD CONSTRAINT "products_source_check" CHECK ("source" IN ('off', 'user'));

-- LGPD: dado de saúde só com consentimento registrado
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_health_consent_check" CHECK (
  "health_consent_at" IS NOT NULL
  OR (cardinality("goals") = 0 AND cardinality("allergens") = 0 AND cardinality("restrictions") = 0)
);

-- Contas vivem em auth.users (Supabase): exclusão em cascata de perfil e histórico
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;
ALTER TABLE "scan_history" ADD CONSTRAINT "scan_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;

-- Busca por nome (trigrama)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX "products_name_trgm_idx" ON "products" USING gin ("name" extensions.gin_trgm_ops);

CREATE FUNCTION "search_products_by_name"(q text, lim int DEFAULT 20)
RETURNS SETOF "products"
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT * FROM "products"
  WHERE "name" ILIKE '%' || q || '%' OR "name" % q
  ORDER BY similarity("name", q) DESC, "name"
  LIMIT lim;
$$;

-- Segurança: RLS ligado e sem políticas = nenhum acesso para anon/authenticated.
-- Só a API (conexão privilegiada via Prisma) lê e grava.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scan_history" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "profiles", "products", "scan_history" FROM anon, authenticated;
REVOKE ALL ON FUNCTION "search_products_by_name"(text, int) FROM anon, authenticated, PUBLIC;
