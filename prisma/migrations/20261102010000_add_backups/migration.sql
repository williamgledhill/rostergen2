-- IF NOT EXISTS lets the migration run against both fresh and pushed databases.
-- CreateTable
CREATE TABLE IF NOT EXISTS "AppBackup" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdById" TEXT,
    "createdByEmail" TEXT,
    "summary" JSONB NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AppBackup_createdAt_idx" ON "AppBackup"("createdAt");
CREATE INDEX IF NOT EXISTS "AppBackup_kind_createdAt_idx" ON "AppBackup"("kind", "createdAt");
