-- CreateTable
CREATE TABLE "AppPerson" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "schedule" JSONB NOT NULL,
    "fortnight" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppTaskTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT,
    "color" TEXT,
    "mustManned" BOOLEAN NOT NULL DEFAULT false,
    "autogenStart" TEXT,
    "autogenEnd" TEXT,
    "regularDays" JSONB,
    "regularTimes" JSONB,
    "regularTimesByDay" JSONB,
    "regularDayWindows" JSONB,
    "minPerEmployeePerDay" INTEGER NOT NULL DEFAULT 0,
    "maxPerEmployeePerDay" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "maxConsecutiveMinutes" INTEGER NOT NULL DEFAULT 0,
    "waitingMinutes" INTEGER NOT NULL DEFAULT 0,
    "packingMinutes" INTEGER NOT NULL DEFAULT 0,
    "limitPerDay" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL,
    "hoursByDay" JSONB NOT NULL,
    "upcomingDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppRoster" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "updatedLabel" TEXT NOT NULL DEFAULT '-',
    "tours" INTEGER NOT NULL DEFAULT 0,
    "people" INTEGER NOT NULL DEFAULT 0,
    "employees" JSONB,
    "tasks" JSONB,
    "hoursStart" TEXT,
    "hoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppRoster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppRoster_date_key" ON "AppRoster"("date");

-- CreateIndex
CREATE INDEX "AppRoster_date_idx" ON "AppRoster"("date");
