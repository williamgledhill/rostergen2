ALTER TABLE "AppTaskTemplate"
ADD COLUMN "maxConcurrentPerTimeslot" INTEGER NOT NULL DEFAULT 0;

UPDATE "AppTaskTemplate"
SET "maxConcurrentPerTimeslot" = 1
WHERE "id" IN ('break', 'morning-break', 'afternoon-break');
