import { AppDayOfWeek, AppScheduleWeekType } from "@prisma/client";
import { prisma } from "./prisma";
import { ALL_DAYS, type DayKey, type DaySchedule, type Person } from "./people";
import { ensureAppPersistenceSeeded } from "./appPersistenceSeed";

const DEFAULT_ANCHOR_DATE = "2026-01-05";

function normalizeDaySchedule(input: any): DaySchedule {
  return {
    enabled: Boolean(input?.enabled),
    start: typeof input?.start === "string" ? input.start : "09:00",
    end: typeof input?.end === "string" ? input.end : "17:00",
  };
}

function emptyWeeklySchedule(): Person["schedule"] {
  const schedule = {} as Person["schedule"];
  ALL_DAYS.forEach((day) => {
    schedule[day] = normalizeDaySchedule(undefined);
  });
  return schedule;
}

function normalizeWeeklySchedule(input: any): Person["schedule"] {
  const schedule = {} as Person["schedule"];
  ALL_DAYS.forEach((day) => {
    schedule[day] = normalizeDaySchedule(input?.[day]);
  });
  return schedule;
}

function mapRowsToWeeklySchedule(
  rows: Array<{ dayOfWeek: AppDayOfWeek; enabled: boolean; start: string; end: string }>
): Person["schedule"] {
  const schedule = emptyWeeklySchedule();
  rows.forEach((row) => {
    schedule[row.dayOfWeek as DayKey] = {
      enabled: row.enabled,
      start: row.start,
      end: row.end,
    };
  });
  return schedule;
}

function mapLegacyPerson(record: {
  id: string;
  name: string;
  email: string | null;
  fortnightAnchorDate?: string | null;
  schedule: unknown;
  fortnight: unknown;
}): Person {
  const fortnight =
    record.fortnight && typeof record.fortnight === "object"
      ? {
          anchorDate:
            record.fortnightAnchorDate ||
            (typeof (record.fortnight as any).anchorDate === "string"
              ? (record.fortnight as any).anchorDate
              : DEFAULT_ANCHOR_DATE),
          weekA: normalizeWeeklySchedule((record.fortnight as any).weekA),
          weekB: normalizeWeeklySchedule((record.fortnight as any).weekB),
        }
      : undefined;

  return {
    id: record.id,
    name: record.name,
    email: record.email || undefined,
    schedule: normalizeWeeklySchedule(record.schedule),
    ...(fortnight ? { fortnight } : {}),
  };
}

function mapPerson(record: {
  id: string;
  name: string;
  email: string | null;
  fortnightAnchorDate: string | null;
  schedule: unknown;
  fortnight: unknown;
  daySchedules: Array<{
    weekType: AppScheduleWeekType;
    dayOfWeek: AppDayOfWeek;
    enabled: boolean;
    start: string;
    end: string;
  }>;
}): Person {
  if (!record.daySchedules.length) {
    return mapLegacyPerson(record);
  }

  const defaultRows = record.daySchedules.filter((row) => row.weekType === "DEFAULT");
  const weekARows = record.daySchedules.filter((row) => row.weekType === "WEEK_A");
  const weekBRows = record.daySchedules.filter((row) => row.weekType === "WEEK_B");

  return {
    id: record.id,
    name: record.name,
    email: record.email || undefined,
    schedule: mapRowsToWeeklySchedule(defaultRows),
    fortnight: {
      anchorDate: record.fortnightAnchorDate || DEFAULT_ANCHOR_DATE,
      weekA: mapRowsToWeeklySchedule(weekARows.length ? weekARows : defaultRows),
      weekB: mapRowsToWeeklySchedule(weekBRows.length ? weekBRows : defaultRows),
    },
  };
}

function scheduleRowsForPerson(person: Person) {
  const rows: Array<{
    weekType: AppScheduleWeekType;
    dayOfWeek: AppDayOfWeek;
    enabled: boolean;
    start: string;
    end: string;
  }> = [];

  ALL_DAYS.forEach((day) => {
    const schedule = person.schedule[day];
    rows.push({
      weekType: "DEFAULT",
      dayOfWeek: day,
      enabled: Boolean(schedule?.enabled),
      start: schedule?.start || "09:00",
      end: schedule?.end || "17:00",
    });
  });

  const weekA = person.fortnight?.weekA || person.schedule;
  const weekB = person.fortnight?.weekB || person.schedule;
  ALL_DAYS.forEach((day) => {
    const schedule = weekA[day];
    rows.push({
      weekType: "WEEK_A",
      dayOfWeek: day,
      enabled: Boolean(schedule?.enabled),
      start: schedule?.start || "09:00",
      end: schedule?.end || "17:00",
    });
  });
  ALL_DAYS.forEach((day) => {
    const schedule = weekB[day];
    rows.push({
      weekType: "WEEK_B",
      dayOfWeek: day,
      enabled: Boolean(schedule?.enabled),
      start: schedule?.start || "09:00",
      end: schedule?.end || "17:00",
    });
  });

  return rows;
}

export async function getPeople(): Promise<Person[]> {
  await ensureAppPersistenceSeeded();
  const people = await prisma.appPerson.findMany({
    orderBy: { name: "asc" },
    include: { daySchedules: true },
  });
  return people.map(mapPerson);
}

export async function getPerson(id: string): Promise<Person | null> {
  await ensureAppPersistenceSeeded();
  const person = await prisma.appPerson.findUnique({
    where: { id },
    include: { daySchedules: true },
  });
  return person ? mapPerson(person) : null;
}

export async function upsertPerson(person: Person): Promise<Person> {
  await ensureAppPersistenceSeeded();

  const fortnightAnchorDate = person.fortnight?.anchorDate || DEFAULT_ANCHOR_DATE;
  const saved = await prisma.$transaction(async (tx) => {
    await tx.appPerson.upsert({
      where: { id: person.id },
      update: {
        name: person.name,
        email: person.email || null,
        fortnightAnchorDate,
        schedule: person.schedule as never,
        fortnight: person.fortnight ? (person.fortnight as never) : undefined,
      },
      create: {
        id: person.id,
        name: person.name,
        email: person.email || null,
        fortnightAnchorDate,
        schedule: person.schedule as never,
        fortnight: person.fortnight ? (person.fortnight as never) : undefined,
      },
    });

    await tx.appPersonDaySchedule.deleteMany({ where: { personId: person.id } });
    await tx.appPersonDaySchedule.createMany({
      data: scheduleRowsForPerson(person).map((row) => ({
        personId: person.id,
        ...row,
      })),
    });

    return tx.appPerson.findUnique({
      where: { id: person.id },
      include: { daySchedules: true },
    });
  });

  return mapPerson(saved!);
}

export async function deletePerson(id: string): Promise<void> {
  await ensureAppPersistenceSeeded();
  await prisma.appPerson.delete({ where: { id } }).catch(() => undefined);
}
