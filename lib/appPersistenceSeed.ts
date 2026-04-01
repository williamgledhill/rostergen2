import fs from "fs/promises";
import path from "path";
import { AppDayOfWeek, AppScheduleWeekType, type Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { seedPeople, type Person } from "./people";
import { defaultTaskTemplates, type TaskTemplate } from "./taskTemplates";
import { DEFAULT_SETTINGS, type AppSettings, DAY_KEYS } from "./settingsDefaults";
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
const DEFAULT_ANCHOR_DATE = "2026-01-05";
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

function personScheduleRows(person: Person) {
  const rows: Array<{
    personId: string;
    weekType: AppScheduleWeekType;
    dayOfWeek: AppDayOfWeek;
    enabled: boolean;
    start: string;
    end: string;
  }> = [];

  DAY_KEYS.forEach((day) => {
    const entry = person.schedule[day];
    rows.push({
      personId: person.id,
      weekType: "DEFAULT",
      dayOfWeek: day as AppDayOfWeek,
      enabled: Boolean(entry?.enabled),
      start: entry?.start || "09:00",
      end: entry?.end || "17:00",
    });
  });

  const weekA = person.fortnight?.weekA || person.schedule;
  const weekB = person.fortnight?.weekB || person.schedule;
  DAY_KEYS.forEach((day) => {
    const entry = weekA[day];
    rows.push({
      personId: person.id,
      weekType: "WEEK_A",
      dayOfWeek: day as AppDayOfWeek,
      enabled: Boolean(entry?.enabled),
      start: entry?.start || "09:00",
      end: entry?.end || "17:00",
    });
  });
  DAY_KEYS.forEach((day) => {
    const entry = weekB[day];
    rows.push({
      personId: person.id,
      weekType: "WEEK_B",
      dayOfWeek: day as AppDayOfWeek,
      enabled: Boolean(entry?.enabled),
      start: entry?.start || "09:00",
      end: entry?.end || "17:00",
    });
  });

  return rows;
}

function templateRelationRows(template: TaskTemplate) {
  const regularDays = Array.isArray(template.regularDays) ? template.regularDays : [];
  const regularTimes = Array.isArray(template.regularTimes) ? template.regularTimes : [];
  const regularTimesByDay =
    template.regularTimesByDay && typeof template.regularTimesByDay === "object" && !Array.isArray(template.regularTimesByDay)
      ? template.regularTimesByDay
      : {};
  const regularDayWindows =
    template.regularDayWindows && typeof template.regularDayWindows === "object" && !Array.isArray(template.regularDayWindows)
      ? template.regularDayWindows
      : {};

  return {
      regularDayRules: regularDays.map((day) => ({
        templateId: template.id,
        dayOfWeek: day as AppDayOfWeek,
      })),
    timeSlots: [
      ...regularTimes.map((time) => ({
        templateId: template.id,
        dayOfWeek: null as AppDayOfWeek | null,
        time,
      })),
      ...Object.entries(regularTimesByDay).flatMap(([day, times]) =>
        (Array.isArray(times) ? times : []).map((time) => ({
          templateId: template.id,
          dayOfWeek: day as AppDayOfWeek,
          time,
        }))
      ),
    ],
    dayWindows: Object.entries(regularDayWindows).map(([day, value]) => ({
      templateId: template.id,
      dayOfWeek: day as AppDayOfWeek,
      start: value?.start || null,
      end: value?.end || null,
    })),
  };
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
      fortnightAnchorDate: person.fortnight?.anchorDate || DEFAULT_ANCHOR_DATE,
      schedule: toInputJson(person.schedule),
      ...(person.fortnight ? { fortnight: toInputJson(person.fortnight) } : {}),
    })),
    skipDuplicates: true,
  });

  await prisma.appPersonDaySchedule.createMany({
    data: people.flatMap(personScheduleRows),
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

  await prisma.appTaskTemplateRegularDay.createMany({
    data: templates.flatMap((template) => templateRelationRows(template).regularDayRules),
    skipDuplicates: true,
  });
  await prisma.appTaskTemplateTimeSlot.createMany({
    data: templates.flatMap((template) => templateRelationRows(template).timeSlots),
    skipDuplicates: true,
  });
  await prisma.appTaskTemplateDayWindow.createMany({
    data: templates.flatMap((template) => templateRelationRows(template).dayWindows),
    skipDuplicates: true,
  });
}

async function seedSettingsIfNeeded() {
  const count = await prisma.appSettings.count();
  if (count > 0) return;

  const fileSettings = await readJsonFile<Partial<AppSettings>>("settings.json");
  const hoursByDay = fileSettings?.hoursByDay || DEFAULT_SETTINGS.hoursByDay;
  const upcomingDays = Number.isFinite(fileSettings?.upcomingDays)
    ? Math.max(1, Math.min(90, Math.floor(Number(fileSettings?.upcomingDays))))
    : DEFAULT_SETTINGS.upcomingDays;

  await prisma.appSettings.create({
    data: {
      id: "default",
      hoursByDay: toInputJson(hoursByDay),
      upcomingDays,
    },
  });

  await prisma.appSettingsDayHours.createMany({
    data: DAY_KEYS.map((day) => ({
      settingsId: "default",
      dayOfWeek: day as AppDayOfWeek,
      start: hoursByDay[day].start,
      end: hoursByDay[day].end,
    })),
    skipDuplicates: true,
  });
}

function rosterEmployeeRows(rosterId: string, employees: unknown[]) {
  return employees.map((employee: any, index) => ({
    rosterId,
    externalId: String(employee?.id ?? index + 1),
    name: String(employee?.name ?? `Employee ${index + 1}`),
    startTime: typeof employee?.startTime === "string" ? employee.startTime : null,
    endTime: typeof employee?.endTime === "string" ? employee.endTime : null,
    position: index + 1,
  }));
}

function rosterTaskRows(rosterId: string, tasks: unknown[]) {
  return tasks.map((task: any, index) => ({
    rosterId,
    externalId: String(task?.id ?? `task-${index + 1}`),
    type: String(task?.type ?? "task"),
    label: String(task?.label ?? "Task"),
    col: Number.isFinite(task?.col) ? Number(task.col) : 0,
    startRow: Number.isFinite(task?.startRow) ? Number(task.startRow) : 0,
    span: Number.isFinite(task?.span) ? Number(task.span) : 1,
    color: typeof task?.color === "string" ? task.color : null,
    employeeId: task?.employeeId !== undefined && task?.employeeId !== null ? String(task.employeeId) : null,
    locked: task?.locked === true,
    isLocked: task?.isLocked === true,
    readOnly: task?.readOnly === true,
    position: index + 1,
  }));
}

async function seedRostersIfNeeded() {
  const count = await prisma.appRoster.count();
  if (count > 0) return;

  const fileRosters = await readJsonFile<SeedRoster[]>("rosters.json");
  const rosters = Array.isArray(fileRosters) ? fileRosters : [];
  if (rosters.length === 0) return;

  const normalized = rosters
    .filter((roster) => typeof roster.id === "string" && roster.id.trim().length > 0)
    .map((roster) => {
      const date = rosterDateFromInput(roster);
      const employees = Array.isArray(roster.employees) ? roster.employees : [];
      const tasks = Array.isArray(roster.tasks) ? roster.tasks : [];
      return {
        id: roster.id,
        date,
        title: roster.title || formatFullDay(date),
        status: roster.status === "Published" ? "Published" : "Draft",
        updatedLabel: roster.updated || "-",
        tours: Number.isFinite(roster.tours) ? Number(roster.tours) : 0,
        people: Number.isFinite(roster.people) ? Number(roster.people) : 0,
        employees,
        tasks,
        hoursStart: roster.hoursStart || null,
        hoursEnd: roster.hoursEnd || null,
      };
    });

  await prisma.appRoster.createMany({
    data: normalized.map((roster) => ({
      id: roster.id,
      date: roster.date,
      title: roster.title,
      status: roster.status,
      updatedLabel: roster.updatedLabel,
      tours: roster.tours,
      people: roster.people,
      employees: toInputJson(roster.employees),
      tasks: toInputJson(roster.tasks),
      hoursStart: roster.hoursStart,
      hoursEnd: roster.hoursEnd,
    })),
    skipDuplicates: true,
  });

  await prisma.appRosterEmployee.createMany({
    data: normalized.flatMap((roster) => rosterEmployeeRows(roster.id, roster.employees)),
    skipDuplicates: true,
  });
  await prisma.appRosterTask.createMany({
    data: normalized.flatMap((roster) => rosterTaskRows(roster.id, roster.tasks)),
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
