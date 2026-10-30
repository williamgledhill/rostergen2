-- This column was added to the production database with `prisma db push`, so
-- IF NOT EXISTS lets the migration run against both fresh and existing databases.
-- AlterTable
ALTER TABLE "AppTaskTemplate" ADD COLUMN IF NOT EXISTS "schoolTourImportTarget" BOOLEAN NOT NULL DEFAULT false;
