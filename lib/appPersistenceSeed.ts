import fs from "fs/promises";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { seedPeople, type Person } from "./people";
import { defaultTaskTemplates, type TaskTemplate } from "./taskTemplates";
import { DEFAULT_SETTINGS, type AppSettings } from "./settingsDefaults";
import { formatFullDay, parseLocalId } from "./dateUtils";

type SeedRoster = {
  id: string;
  title?: string;
  start?: string | Date;
  end?: string | Date;
  status?: "Draft" | "Published";
  updated?: string;
  tours?: number;
  people?: number;
  employees?: unknown[];
  tasks?: unknown[];
  hoursStart?: string;
  hoursEnd?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
let seedPromise: Promise<void> | null = null;

async function readJsonFile<T>(fileName: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, fileName), "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function rosterDateFromInput(roster: SeedRoster) {
  return parseLocalId(roster.id) ?? new Date(roster.start ?? roster.id);
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

async function seedPeopleIfNeeded() {
  const count = await prisma.appPerson.count();
  if (count > 0) return;

  const filePeople = await readJsonFile<Person[]>("people.json");
  const people = Array.isArray(filePeople) && filePeople.length ? filePeople : seedPeople;
  await prisma.appPerson.createMany({
    data: people.map((person) => ({
      id: person.id,
      name: person.name,
      email: person.email || null,
      schedule: toInputJson(person.schedule),
      ...(person.fortnight ? { fortnight: toInputJson(person.fortnight) } : {}),
    })),
    skipDuplicates: true,
  });
}

async function seedTaskTemplatesIfNeeded() {
  const count = await prisma.appTaskTemplate.count();
  if (count > 0) return;

  const fileTemplates = await readJsonFile<TaskTemplate[]>("taskTemplates.json");
  const templates =
    Array.isArray(fileTemplates) && fileTemplates.length ? fileTemplates : defaultTaskTemplates;

  await prisma.appTaskTemplate.createMany({
    data: templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description || "",
      category: template.category || null,
      color: template.color || null,
      mustManned: Boolean(template.mustManned),
      autogenStart: template.autogenStart || null,
      autogenEnd: template.autogenEnd || null,
      regularDays: toInputJson(template.regularDays || []),
      regularTimes: toInputJson(template.regularTimes || []),
      regularTimesByDay: toInputJson(template.regularTimesByDay || {}),
      regularDayWindows: toInputJson(template.regularDayWindows || {}),
      minPerEmployeePerDay: Number.isFinite(template.minPerEmployeePerDay)
        ? Number(template.minPerEmployeePerDay)
        : 0,
      maxPerEmployeePerDay: Number.isFinite(template.maxPerEmployeePerDay)
        ? Number(template.maxPerEmployeePerDay)
        : 0,
      durationMinutes: Number.isFinite(template.durationMinutes)
        ? Number(template.durationMinutes)
        : 0,
      maxConsecutiveMinutes: Number.isFinite(template.maxConsecutiveMinutes)
        ? Number(template.maxConsecutiveMinutes)
        : 0,
      waitingMinutes: Number.isFinite(template.waitingMinutes)
        ? Number(template.waitingMinutes)
        : 0,
      packingMinutes: Number.isFinite(template.packingMinutes)
        ? Number(template.packingMinutes)
        : 0,
      limitPerDay: Number.isFinite(template.limitPerDay) ? Number(template.limitPerDay) : 0,
      enabled: template.enabled !== false,
    })),
    skipDuplicates: true,
  });
}

async function seedSettingsIfNeeded() {
  const count = await prisma.appSettings.count();
  if (count > 0) return;

  const fileSettings = await readJsonFile<Partial<AppSettings>>("settings.json");
  await prisma.appSettings.create({
    data: {
      id: "default",
      hoursByDay: toInputJson(fileSettings?.hoursByDay || DEFAULT_SETTINGS.hoursByDay),
      upcomingDays: Number.isFinite(fileSettings?.upcomingDays)
        ? Math.max(1, Math.min(90, Math.floor(Number(fileSettings?.upcomingDays))))
        : DEFAULT_SETTINGS.upcomingDays,
    },
  });
}

async function seedRostersIfNeeded() {
  const count = await prisma.appRoster.count();
  if (count > 0) return;

  const fileRosters = await readJsonFile<SeedRoster[]>("rosters.json");
  const rosters = Array.isArray(fileRosters) ? fileRosters : [];
  if (rosters.length === 0) return;

  await prisma.appRoster.createMany({
    data: rosters
      .filter((roster) => typeof roster.id === "string" && roster.id.trim().length > 0)
      .map((roster) => {
        const date = rosterDateFromInput(roster);
        return {
          id: roster.id,
          date,
          title: roster.title || formatFullDay(date),
          status: roster.status === "Published" ? "Published" : "Draft",
          updatedLabel: roster.updated || "-",
          tours: Number.isFinite(roster.tours) ? Number(roster.tours) : 0,
          people: Number.isFinite(roster.people) ? Number(roster.people) : 0,
          employees: toInputJson(Array.isArray(roster.employees) ? roster.employees : []),
          tasks: toInputJson(Array.isArray(roster.tasks) ? roster.tasks : []),
          hoursStart: roster.hoursStart || null,
          hoursEnd: roster.hoursEnd || null,
        };
      }),
    skipDuplicates: true,
  });
}

export async function ensureAppPersistenceSeeded() {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    await seedPeopleIfNeeded();
    await seedTaskTemplatesIfNeeded();
    await seedSettingsIfNeeded();
    await seedRostersIfNeeded();
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });

  return seedPromise;
}
