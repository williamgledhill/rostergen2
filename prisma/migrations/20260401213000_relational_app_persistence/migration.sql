-- CreateEnum
CREATE TYPE "AppDayOfWeek" AS ENUM ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');

-- CreateEnum
CREATE TYPE "AppScheduleWeekType" AS ENUM ('DEFAULT', 'WEEK_A', 'WEEK_B');

-- AlterTable
ALTER TABLE "AppPerson" ADD COLUMN "fortnightAnchorDate" TEXT;

-- CreateTable
CREATE TABLE "AppPersonDaySchedule" (
    "id" SERIAL NOT NULL,
    "personId" TEXT NOT NULL,
    "weekType" "AppScheduleWeekType" NOT NULL,
    "dayOfWeek" "AppDayOfWeek" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppPersonDaySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppTaskTemplateRegularDay" (
    "id" SERIAL NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayOfWeek" "AppDayOfWeek" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppTaskTemplateRegularDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppTaskTemplateTimeSlot" (
    "id" SERIAL NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayOfWeek" "AppDayOfWeek",
    "time" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppTaskTemplateTimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppTaskTemplateDayWindow" (
    "id" SERIAL NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayOfWeek" "AppDayOfWeek" NOT NULL,
    "start" TEXT,
    "end" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppTaskTemplateDayWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettingsDayHours" (
    "id" SERIAL NOT NULL,
    "settingsId" TEXT NOT NULL,
    "dayOfWeek" "AppDayOfWeek" NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettingsDayHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppRosterEmployee" (
    "id" SERIAL NOT NULL,
    "rosterId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRosterEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppRosterTask" (
    "id" SERIAL NOT NULL,
    "rosterId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "col" INTEGER NOT NULL,
    "startRow" INTEGER NOT NULL,
    "span" INTEGER NOT NULL,
    "color" TEXT,
    "employeeId" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "readOnly" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRosterTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppPersonDaySchedule_personId_weekType_dayOfWeek_key" ON "AppPersonDaySchedule"("personId", "weekType", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AppPersonDaySchedule_personId_weekType_idx" ON "AppPersonDaySchedule"("personId", "weekType");

-- CreateIndex
CREATE UNIQUE INDEX "AppTaskTemplateRegularDay_templateId_dayOfWeek_key" ON "AppTaskTemplateRegularDay"("templateId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AppTaskTemplateRegularDay_templateId_idx" ON "AppTaskTemplateRegularDay"("templateId");

-- CreateIndex
CREATE INDEX "AppTaskTemplateTimeSlot_templateId_dayOfWeek_idx" ON "AppTaskTemplateTimeSlot"("templateId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "AppTaskTemplateDayWindow_templateId_dayOfWeek_key" ON "AppTaskTemplateDayWindow"("templateId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AppTaskTemplateDayWindow_templateId_idx" ON "AppTaskTemplateDayWindow"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettingsDayHours_settingsId_dayOfWeek_key" ON "AppSettingsDayHours"("settingsId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "AppSettingsDayHours_settingsId_idx" ON "AppSettingsDayHours"("settingsId");

-- CreateIndex
CREATE UNIQUE INDEX "AppRosterEmployee_rosterId_position_key" ON "AppRosterEmployee"("rosterId", "position");

-- CreateIndex
CREATE INDEX "AppRosterEmployee_rosterId_idx" ON "AppRosterEmployee"("rosterId");

-- CreateIndex
CREATE INDEX "AppRosterEmployee_rosterId_externalId_idx" ON "AppRosterEmployee"("rosterId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "AppRosterTask_rosterId_position_key" ON "AppRosterTask"("rosterId", "position");

-- CreateIndex
CREATE INDEX "AppRosterTask_rosterId_idx" ON "AppRosterTask"("rosterId");

-- CreateIndex
CREATE INDEX "AppRosterTask_rosterId_col_startRow_idx" ON "AppRosterTask"("rosterId", "col", "startRow");

-- CreateIndex
CREATE INDEX "AppRosterTask_rosterId_employeeId_idx" ON "AppRosterTask"("rosterId", "employeeId");

-- AddForeignKey
ALTER TABLE "AppPersonDaySchedule" ADD CONSTRAINT "AppPersonDaySchedule_personId_fkey" FOREIGN KEY ("personId") REFERENCES "AppPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppTaskTemplateRegularDay" ADD CONSTRAINT "AppTaskTemplateRegularDay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AppTaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppTaskTemplateTimeSlot" ADD CONSTRAINT "AppTaskTemplateTimeSlot_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AppTaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppTaskTemplateDayWindow" ADD CONSTRAINT "AppTaskTemplateDayWindow_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AppTaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSettingsDayHours" ADD CONSTRAINT "AppSettingsDayHours_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "AppSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppRosterEmployee" ADD CONSTRAINT "AppRosterEmployee_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "AppRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppRosterTask" ADD CONSTRAINT "AppRosterTask_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "AppRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill person anchor dates
UPDATE "AppPerson"
SET "fortnightAnchorDate" = COALESCE("fortnight" ->> 'anchorDate', '2026-01-05')
WHERE "fortnightAnchorDate" IS NULL;

-- Backfill person schedules
INSERT INTO "AppPersonDaySchedule" ("personId", "weekType", "dayOfWeek", "enabled", "start", "end", "createdAt", "updatedAt")
SELECT
  p."id",
  'DEFAULT'::"AppScheduleWeekType",
  d.day::"AppDayOfWeek",
  COALESCE((p."schedule" -> d.day ->> 'enabled')::BOOLEAN, false),
  COALESCE(p."schedule" -> d.day ->> 'start', '09:00'),
  COALESCE(p."schedule" -> d.day ->> 'end', '17:00'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AppPerson" p
CROSS JOIN (VALUES ('Mon'), ('Tue'), ('Wed'), ('Thu'), ('Fri'), ('Sat'), ('Sun')) AS d(day)
ON CONFLICT ("personId", "weekType", "dayOfWeek") DO NOTHING;

INSERT INTO "AppPersonDaySchedule" ("personId", "weekType", "dayOfWeek", "enabled", "start", "end", "createdAt", "updatedAt")
SELECT
  p."id",
  'WEEK_A'::"AppScheduleWeekType",
  d.day::"AppDayOfWeek",
  COALESCE((p."fortnight" -> 'weekA' -> d.day ->> 'enabled')::BOOLEAN, false),
  COALESCE(p."fortnight" -> 'weekA' -> d.day ->> 'start', '09:00'),
  COALESCE(p."fortnight" -> 'weekA' -> d.day ->> 'end', '17:00'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AppPerson" p
CROSS JOIN (VALUES ('Mon'), ('Tue'), ('Wed'), ('Thu'), ('Fri'), ('Sat'), ('Sun')) AS d(day)
WHERE p."fortnight" IS NOT NULL
ON CONFLICT ("personId", "weekType", "dayOfWeek") DO NOTHING;

INSERT INTO "AppPersonDaySchedule" ("personId", "weekType", "dayOfWeek", "enabled", "start", "end", "createdAt", "updatedAt")
SELECT
  p."id",
  'WEEK_B'::"AppScheduleWeekType",
  d.day::"AppDayOfWeek",
  COALESCE((p."fortnight" -> 'weekB' -> d.day ->> 'enabled')::BOOLEAN, false),
  COALESCE(p."fortnight" -> 'weekB' -> d.day ->> 'start', '09:00'),
  COALESCE(p."fortnight" -> 'weekB' -> d.day ->> 'end', '17:00'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AppPerson" p
CROSS JOIN (VALUES ('Mon'), ('Tue'), ('Wed'), ('Thu'), ('Fri'), ('Sat'), ('Sun')) AS d(day)
WHERE p."fortnight" IS NOT NULL
ON CONFLICT ("personId", "weekType", "dayOfWeek") DO NOTHING;

-- Backfill task template regular days
INSERT INTO "AppTaskTemplateRegularDay" ("templateId", "dayOfWeek", "createdAt")
SELECT
  t."id",
  day_value::"AppDayOfWeek",
  CURRENT_TIMESTAMP
FROM "AppTaskTemplate" t
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(t."regularDays", '[]'::jsonb)) AS day_values(day_value)
WHERE day_value IN ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')
ON CONFLICT ("templateId", "dayOfWeek") DO NOTHING;

-- Backfill global task template time slots
INSERT INTO "AppTaskTemplateTimeSlot" ("templateId", "dayOfWeek", "time", "createdAt")
SELECT
  t."id",
  NULL,
  time_value,
  CURRENT_TIMESTAMP
FROM "AppTaskTemplate" t
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(t."regularTimes", '[]'::jsonb)) AS time_values(time_value);

-- Backfill per-day task template time slots
INSERT INTO "AppTaskTemplateTimeSlot" ("templateId", "dayOfWeek", "time", "createdAt")
SELECT
  t."id",
  d.day::"AppDayOfWeek",
  time_value,
  CURRENT_TIMESTAMP
FROM "AppTaskTemplate" t
CROSS JOIN (VALUES ('Mon'), ('Tue'), ('Wed'), ('Thu'), ('Fri'), ('Sat'), ('Sun')) AS d(day)
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(t."regularTimesByDay" -> d.day, '[]'::jsonb)) AS time_values(time_value);

-- Backfill task template day windows
INSERT INTO "AppTaskTemplateDayWindow" ("templateId", "dayOfWeek", "start", "end", "createdAt", "updatedAt")
SELECT
  t."id",
  d.day::"AppDayOfWeek",
  NULLIF(t."regularDayWindows" -> d.day ->> 'start', ''),
  NULLIF(t."regularDayWindows" -> d.day ->> 'end', ''),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AppTaskTemplate" t
CROSS JOIN (VALUES ('Mon'), ('Tue'), ('Wed'), ('Thu'), ('Fri'), ('Sat'), ('Sun')) AS d(day)
WHERE t."regularDayWindows" ? d.day
ON CONFLICT ("templateId", "dayOfWeek") DO NOTHING;

-- Backfill settings day hours
INSERT INTO "AppSettingsDayHours" ("settingsId", "dayOfWeek", "start", "end", "createdAt", "updatedAt")
SELECT
  s."id",
  d.day::"AppDayOfWeek",
  COALESCE(s."hoursByDay" -> d.day ->> 'start', '09:30'),
  COALESCE(s."hoursByDay" -> d.day ->> 'end', '16:00'),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AppSettings" s
CROSS JOIN (VALUES ('Mon'), ('Tue'), ('Wed'), ('Thu'), ('Fri'), ('Sat'), ('Sun')) AS d(day)
ON CONFLICT ("settingsId", "dayOfWeek") DO NOTHING;

-- Backfill roster employees
INSERT INTO "AppRosterEmployee" ("rosterId", "externalId", "name", "startTime", "endTime", "position", "createdAt", "updatedAt")
SELECT
  r."id",
  COALESCE(NULLIF(employee_value ->> 'id', ''), employee_index::TEXT),
  COALESCE(NULLIF(employee_value ->> 'name', ''), 'Employee ' || employee_index::TEXT),
  NULLIF(employee_value ->> 'startTime', ''),
  NULLIF(employee_value ->> 'endTime', ''),
  employee_index::INTEGER,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AppRoster" r
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r."employees", '[]'::jsonb)) WITH ORDINALITY AS employee_entries(employee_value, employee_index)
ON CONFLICT ("rosterId", "position") DO NOTHING;

-- Backfill roster tasks
INSERT INTO "AppRosterTask" (
  "rosterId",
  "externalId",
  "type",
  "label",
  "col",
  "startRow",
  "span",
  "color",
  "employeeId",
  "locked",
  "isLocked",
  "readOnly",
  "position",
  "createdAt",
  "updatedAt"
)
SELECT
  r."id",
  COALESCE(NULLIF(task_value ->> 'id', ''), 'task-' || task_index::TEXT),
  COALESCE(NULLIF(task_value ->> 'type', ''), 'task'),
  COALESCE(NULLIF(task_value ->> 'label', ''), 'Task'),
  CASE WHEN COALESCE(task_value ->> 'col', '') ~ '^\d+$' THEN (task_value ->> 'col')::INTEGER ELSE 0 END,
  CASE WHEN COALESCE(task_value ->> 'startRow', '') ~ '^\d+$' THEN (task_value ->> 'startRow')::INTEGER ELSE 0 END,
  CASE WHEN COALESCE(task_value ->> 'span', '') ~ '^\d+$' THEN (task_value ->> 'span')::INTEGER ELSE 1 END,
  NULLIF(task_value ->> 'color', ''),
  NULLIF(task_value ->> 'employeeId', ''),
  CASE WHEN COALESCE(task_value ->> 'locked', '') IN ('true', 'false') THEN (task_value ->> 'locked')::BOOLEAN ELSE false END,
  CASE WHEN COALESCE(task_value ->> 'isLocked', '') IN ('true', 'false') THEN (task_value ->> 'isLocked')::BOOLEAN ELSE false END,
  CASE WHEN COALESCE(task_value ->> 'readOnly', '') IN ('true', 'false') THEN (task_value ->> 'readOnly')::BOOLEAN ELSE false END,
  task_index::INTEGER,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "AppRoster" r
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r."tasks", '[]'::jsonb)) WITH ORDINALITY AS task_entries(task_value, task_index)
ON CONFLICT ("rosterId", "position") DO NOTHING;
