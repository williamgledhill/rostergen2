import { prisma } from "./prisma";
import { ALL_DAYS, type DaySchedule, type Person } from "./people";
import { ensureAppPersistenceSeeded } from "./appPersistenceSeed";

function normalizeDaySchedule(input: any): DaySchedule {
  return {
    enabled: Boolean(input?.enabled),
    start: typeof input?.start === "string" ? input.start : "09:00",
    end: typeof input?.end === "string" ? input.end : "17:00",
  };
}

function normalizeWeeklySchedule(input: any): Person["schedule"] {
  const schedule = {} as Person["schedule"];
  ALL_DAYS.forEach((day) => {
    schedule[day] = normalizeDaySchedule(input?.[day]);
  });
  return schedule;
}

function normalizePerson(record: {
  id: string;
  name: string;
  email: string | null;
  schedule: unknown;
  fortnight: unknown;
}): Person {
  const fortnight =
    record.fortnight && typeof record.fortnight === "object"
      ? {
          anchorDate:
            typeof (record.fortnight as any).anchorDate === "string"
              ? (record.fortnight as any).anchorDate
              : "2026-01-05",
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

export async function getPeople(): Promise<Person[]> {
  await ensureAppPersistenceSeeded();
  const people = await prisma.appPerson.findMany({ orderBy: { name: "asc" } });
  return people.map(normalizePerson);
}

export async function getPerson(id: string): Promise<Person | null> {
  await ensureAppPersistenceSeeded();
  const person = await prisma.appPerson.findUnique({ where: { id } });
  return person ? normalizePerson(person) : null;
}

export async function upsertPerson(person: Person): Promise<Person> {
  await ensureAppPersistenceSeeded();

  const saved = await prisma.appPerson.upsert({
    where: { id: person.id },
    update: {
      name: person.name,
      email: person.email || null,
      schedule: person.schedule as any,
      fortnight: person.fortnight ? (person.fortnight as any) : undefined,
    },
    create: {
      id: person.id,
      name: person.name,
      email: person.email || null,
      schedule: person.schedule as any,
      ...(person.fortnight ? { fortnight: person.fortnight as any } : {}),
    },
  });

  return normalizePerson(saved);
}

export async function deletePerson(id: string): Promise<void> {
  await ensureAppPersistenceSeeded();
  await prisma.appPerson.delete({ where: { id } }).catch(() => undefined);
}
