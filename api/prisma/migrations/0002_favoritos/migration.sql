-- CreateTable
CREATE TABLE "favorites" (
    "user_id" UUID NOT NULL,
    "barcode" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id", "barcode")
);

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_barcode_fkey" FOREIGN KEY ("barcode") REFERENCES "products"("barcode") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ===== SQL manual (o Prisma não modela) =====

-- Contas vivem em auth.users (Supabase): exclusão em cascata das listas
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;

-- Segurança: mesmo padrão das demais tabelas (RLS ligado, sem políticas, sem acesso para anon/authenticated).
ALTER TABLE "favorites" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "favorites" FROM anon, authenticated;
