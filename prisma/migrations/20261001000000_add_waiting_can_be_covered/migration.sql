-- IF NOT EXISTS lets the migration run against both fresh and pushed databases.
-- AlterTable
ALTER TABLE "AppTaskTemplate" ADD COLUMN IF NOT EXISTS "waitingCanBeCovered" BOOLEAN NOT NULL DEFAULT false;
