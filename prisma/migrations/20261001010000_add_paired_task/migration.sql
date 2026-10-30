-- IF NOT EXISTS lets the migration run against both fresh and pushed databases.
-- AlterTable
ALTER TABLE "AppTaskTemplate" ADD COLUMN IF NOT EXISTS "pairedWithTaskId" TEXT;
ALTER TABLE "AppTaskTemplate" ADD COLUMN IF NOT EXISTS "pairedPosition" TEXT;
