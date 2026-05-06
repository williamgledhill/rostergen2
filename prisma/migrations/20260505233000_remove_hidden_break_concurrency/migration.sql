UPDATE "AppTaskTemplate"
SET "maxConcurrentPerTimeslot" = 0
WHERE "id" IN ('break', 'morning-break', 'afternoon-break')
  AND "maxConcurrentPerTimeslot" = 1;
