-- IF NOT EXISTS lets the migration run against both fresh and pushed databases.
-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "pendingApproval" BOOLEAN NOT NULL DEFAULT false;

-- Account requests made before this migration were inactive users that had never signed in.
UPDATE "AppUser" SET "pendingApproval" = true WHERE "isActive" = false AND "lastLoginAt" IS NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppPasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppPasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AppAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetEmail" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AppPasswordReset_tokenHash_key" ON "AppPasswordReset"("tokenHash");
CREATE INDEX IF NOT EXISTS "AppPasswordReset_userId_idx" ON "AppPasswordReset"("userId");
CREATE INDEX IF NOT EXISTS "AppPasswordReset_expiresAt_idx" ON "AppPasswordReset"("expiresAt");
CREATE INDEX IF NOT EXISTS "AppAuditLog_createdAt_idx" ON "AppAuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "AppAuditLog_targetUserId_idx" ON "AppAuditLog"("targetUserId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AppPasswordReset" ADD CONSTRAINT "AppPasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
