-- AlterTable
ALTER TABLE "AppRosterTask" ADD COLUMN     "packingMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "waitingMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AppTaskTemplate" ADD COLUMN     "attendedByAll" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "overwriteExistingTasks" BOOLEAN NOT NULL DEFAULT false;
