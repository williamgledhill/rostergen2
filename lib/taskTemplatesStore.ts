import { AppDayOfWeek } from "@prisma/client";
import { prisma } from "./prisma";
import { ensureAppPersistenceSeeded } from "./appPersistenceSeed";
import { defaultTaskTemplates, TaskTemplate, slugifyName } from "./taskTemplates";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "./cacheTags";

let defaultTemplateSyncPromise: Promise<void> | null = null;
const runtimeTemplateSyncEnabled =
  process.env.APP_RUNTIME_SEED === "true" || process.env.NODE_ENV !== "production";

function applyDefaults(t: TaskTemplate): TaskTemplate {
  const base = defaultTaskTemplates.find((d) => d.id === t.id);
  const minPerEmployeePerDay = Number.isFinite(t.minPerEmployeePerDay)
    ? Number(t.minPerEmployeePerDay)
    : Number.isFinite(base?.minPerEmployeePerDay)
      ? Number(base?.minPerEmployeePerDay)
      : 0;
  const maxPerEmployeePerDay = Number.isFinite(t.maxPerEmployeePerDay)
    ? Number(t.maxPerEmployeePerDay)
    : Number.isFinite(base?.maxPerEmployeePerDay)
      ? Number(base?.maxPerEmployeePerDay)
      : 0;
  const durationMinutes = Number.isFinite(t.durationMinutes)
    ? Number(t.durationMinutes)
    : Number.isFinite(base?.durationMinutes)
      ? Number(base?.durationMinutes)
      : 0;
  const maxConsecutiveMinutes = Number.isFinite(t.maxConsecutiveMinutes)
    ? Number(t.maxConsecutiveMinutes)
    : Number.isFinite(base?.maxConsecutiveMinutes)
      ? Number(base?.maxConsecutiveMinutes)
      : 0;
  const regularDayWindows =
    t.regularDayWindows && typeof t.regularDayWindows === "object" && !Array.isArray(t.regularDayWindows)
      ? t.regularDayWindows
      : base?.regularDayWindows || {};
  const regularTimesByDay =
    t.regularTimesByDay && typeof t.regularTimesByDay === "object" && !Array.isArray(t.regularTimesByDay)
      ? t.regularTimesByDay
      : base?.regularTimesByDay || {};
  const waitingMinutes = Number.isFinite(t.waitingMinutes)
    ? Number(t.waitingMinutes)
    : Number.isFinite(base?.waitingMinutes)
      ? Number(base?.waitingMinutes)
      : 0;
  const packingMinutes = Number.isFinite(t.packingMinutes)
    ? Number(t.packingMinutes)
    : Number.isFinite(base?.packingMinutes)
      ? Number(base?.packingMinutes)
      : 0;
  const limitPerDay = Number.isFinite(t.limitPerDay)
    ? Number(t.limitPerDay)
    : Number.isFinite(base?.limitPerDay)
      ? Number(base?.limitPerDay)
      : 0;
  const maxConcurrentPerTimeslot = Number.isFinite(t.maxConcurrentPerTimeslot)
    ? Number(t.maxConcurrentPerTimeslot)
    : Number.isFinite(base?.maxConcurrentPerTimeslot)
      ? Number(base?.maxConcurrentPerTimeslot)
      : 0;
  const enabled = typeof t.enabled === "boolean" ? t.enabled : base?.enabled ?? true;
  return {
    ...base,
    ...t,
    color: t.color || base?.color || "#e2e8f0",
    mustManned: typeof t.mustManned === "boolean" ? t.mustManned : base?.mustManned || false,
    autogenStart: t.autogenStart || base?.autogenStart || "",
    autogenEnd: t.autogenEnd || base?.autogenEnd || "",
    regularDays: Array.isArray(t.regularDays) ? t.regularDays : base?.regularDays || [],
    regularTimes: Array.isArray(t.regularTimes) ? t.regularTimes : base?.regularTimes || [],
    regularTimesByDay,
    regularDayWindows,
    minPerEmployeePerDay,
    maxPerEmployeePerDay,
    durationMinutes,
    maxConsecutiveMinutes,
    waitingMinutes,
    packingMinutes,
    limitPerDay,
    maxConcurrentPerTimeslot,
    enabled,
  };
}

function toTemplateCreateInput(template: TaskTemplate) {
  return {
    id: template.id,
    name: template.name,
    description: template.description || "",
    category: template.category || null,
    color: template.color || null,
    mustManned: Boolean(template.mustManned),
    autogenStart: template.autogenStart || null,
    autogenEnd: template.autogenEnd || null,
    regularDays: template.regularDays || [],
    regularTimes: template.regularTimes || [],
    regularTimesByDay: template.regularTimesByDay || {},
    regularDayWindows: template.regularDayWindows || {},
    minPerEmployeePerDay: Number.isFinite(template.minPerEmployeePerDay)
      ? Number(template.minPerEmployeePerDay)
      : 0,
    maxPerEmployeePerDay: Number.isFinite(template.maxPerEmployeePerDay)
      ? Number(template.maxPerEmployeePerDay)
      : 0,
    durationMinutes: Number.isFinite(template.durationMinutes) ? Number(template.durationMinutes) : 0,
    maxConsecutiveMinutes: Number.isFinite(template.maxConsecutiveMinutes)
      ? Number(template.maxConsecutiveMinutes)
      : 0,
    waitingMinutes: Number.isFinite(template.waitingMinutes) ? Number(template.waitingMinutes) : 0,
    packingMinutes: Number.isFinite(template.packingMinutes) ? Number(template.packingMinutes) : 0,
    limitPerDay: Number.isFinite(template.limitPerDay) ? Number(template.limitPerDay) : 0,
    maxConcurrentPerTimeslot: Number.isFinite(template.maxConcurrentPerTimeslot)
      ? Number(template.maxConcurrentPerTimeslot)
      : 0,
    enabled: template.enabled !== false,
  };
}

function toRelationRows(templateId: string, template: Partial<TaskTemplate>) {
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
      templateId,
      dayOfWeek: day as AppDayOfWeek,
    })),
    timeSlots: [
      ...regularTimes.map((time) => ({
        templateId,
        dayOfWeek: null as AppDayOfWeek | null,
        time,
      })),
      ...Object.entries(regularTimesByDay).flatMap(([day, times]) =>
        (Array.isArray(times) ? times : []).map((time) => ({
          templateId,
          dayOfWeek: day as AppDayOfWeek,
          time,
        }))
      ),
    ],
    dayWindows: Object.entries(regularDayWindows).map(([day, value]) => ({
      templateId,
      dayOfWeek: day as AppDayOfWeek,
      start: value?.start || null,
      end: value?.end || null,
    })),
  };
}

async function ensureDefaultTaskTemplatesSynced() {
  if (!runtimeTemplateSyncEnabled) return;
  if (defaultTemplateSyncPromise) return defaultTemplateSyncPromise;

  defaultTemplateSyncPromise = (async () => {
    await prisma.appTaskTemplate.createMany({
      data: defaultTaskTemplates.map(toTemplateCreateInput),
      skipDuplicates: true,
    });

    for (const template of defaultTaskTemplates) {
      const relations = toRelationRows(template.id, template);
      if (relations.regularDayRules.length) {
        await prisma.appTaskTemplateRegularDay.createMany({
          data: relations.regularDayRules,
          skipDuplicates: true,
        });
      }
      if (relations.timeSlots.length) {
        await prisma.appTaskTemplateTimeSlot.createMany({
          data: relations.timeSlots,
          skipDuplicates: true,
        });
      }
      if (relations.dayWindows.length) {
        await prisma.appTaskTemplateDayWindow.createMany({
          data: relations.dayWindows,
          skipDuplicates: true,
        });
      }
    }
  })().catch((error) => {
    defaultTemplateSyncPromise = null;
    throw error;
  });

  return defaultTemplateSyncPromise;
}

function mapLegacyTemplate(record: any): TaskTemplate {
  return applyDefaults({
    id: record.id,
    name: record.name,
    description: record.description || "",
    category: record.category || undefined,
    color: record.color || undefined,
    mustManned: record.mustManned,
    autogenStart: record.autogenStart || "",
    autogenEnd: record.autogenEnd || "",
    regularDays: Array.isArray(record.regularDays) ? record.regularDays : [],
    regularTimes: Array.isArray(record.regularTimes) ? record.regularTimes : [],
    regularTimesByDay:
      record.regularTimesByDay && typeof record.regularTimesByDay === "object"
        ? record.regularTimesByDay
        : {},
    regularDayWindows:
      record.regularDayWindows && typeof record.regularDayWindows === "object"
        ? record.regularDayWindows
        : {},
    minPerEmployeePerDay: record.minPerEmployeePerDay,
    maxPerEmployeePerDay: record.maxPerEmployeePerDay,
    durationMinutes: record.durationMinutes,
    maxConsecutiveMinutes: record.maxConsecutiveMinutes,
    waitingMinutes: record.waitingMinutes,
    packingMinutes: record.packingMinutes,
    limitPerDay: record.limitPerDay,
    maxConcurrentPerTimeslot: record.maxConcurrentPerTimeslot,
    enabled: record.enabled,
  });
}

function mapTemplate(record: any): TaskTemplate {
  if (!record.regularDayRules && !record.timeSlots && !record.dayWindows) {
    return mapLegacyTemplate(record);
  }

  const regularDays = (record.regularDayRules || [])
    .map((row: { dayOfWeek: AppDayOfWeek }) => row.dayOfWeek)
    .sort();
  const regularTimes = (record.timeSlots || [])
    .filter((row: { dayOfWeek: AppDayOfWeek | null }) => !row.dayOfWeek)
    .map((row: { time: string }) => row.time)
    .sort();
  const regularTimesByDay = Object.fromEntries(
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => [
      day,
      (record.timeSlots || [])
        .filter((row: { dayOfWeek: AppDayOfWeek | null; time: string }) => row.dayOfWeek === day)
        .map((row: { time: string }) => row.time)
        .sort(),
    ]).filter(([, times]) => (times as string[]).length > 0)
  );
  const regularDayWindows = Object.fromEntries(
    (record.dayWindows || []).map((row: { dayOfWeek: AppDayOfWeek; start: string | null; end: string | null }) => [
      row.dayOfWeek,
      {
        ...(row.start ? { start: row.start } : {}),
        ...(row.end ? { end: row.end } : {}),
      },
    ])
  );

  return applyDefaults({
    id: record.id,
    name: record.name,
    description: record.description || "",
    category: record.category || undefined,
    color: record.color || undefined,
    mustManned: record.mustManned,
    autogenStart: record.autogenStart || "",
    autogenEnd: record.autogenEnd || "",
    regularDays,
    regularTimes,
    regularTimesByDay,
    regularDayWindows,
    minPerEmployeePerDay: record.minPerEmployeePerDay,
    maxPerEmployeePerDay: record.maxPerEmployeePerDay,
    durationMinutes: record.durationMinutes,
    maxConsecutiveMinutes: record.maxConsecutiveMinutes,
    waitingMinutes: record.waitingMinutes,
    packingMinutes: record.packingMinutes,
    limitPerDay: record.limitPerDay,
    maxConcurrentPerTimeslot: record.maxConcurrentPerTimeslot,
    enabled: record.enabled,
  });
}

async function loadTaskTemplates(): Promise<TaskTemplate[]> {
  await ensureAppPersistenceSeeded();
  await ensureDefaultTaskTemplatesSynced();
  const templates = await prisma.appTaskTemplate.findMany({
    orderBy: { name: "asc" },
    include: {
      regularDayRules: true,
      timeSlots: true,
      dayWindows: true,
    },
  });
  return templates.map(mapTemplate);
}

const getTaskTemplatesCached = unstable_cache(async () => loadTaskTemplates(), ["tasks:list"], {
  tags: [CACHE_TAGS.tasks],
});

export async function getTaskTemplates(): Promise<TaskTemplate[]> {
  return getTaskTemplatesCached();
}

async function loadTaskTemplateById(id: string): Promise<TaskTemplate | null> {
  await ensureAppPersistenceSeeded();
  await ensureDefaultTaskTemplatesSynced();
  const template = await prisma.appTaskTemplate.findUnique({
    where: { id },
    include: {
      regularDayRules: true,
      timeSlots: true,
      dayWindows: true,
    },
  });
  return template ? mapTemplate(template) : null;
}

const getTaskTemplateByIdCached = unstable_cache(async (id: string) => loadTaskTemplateById(id), ["tasks:by-id"], {
  tags: [CACHE_TAGS.tasks],
});

export async function getTaskTemplateById(id: string): Promise<TaskTemplate | null> {
  return getTaskTemplateByIdCached(id);
}

export async function addTaskTemplate(input: {
  name: string;
  description?: string;
  category?: string;
  color?: string;
}): Promise<TaskTemplate> {
  await ensureAppPersistenceSeeded();
  await ensureDefaultTaskTemplatesSynced();

  const templates = await prisma.appTaskTemplate.findMany({ select: { id: true } });
  const baseSlug = slugifyName(input.name);
  let slug = baseSlug;
  let counter = 1;
  while (templates.some((t) => t.id === slug)) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  const created = await prisma.appTaskTemplate.create({
    data: {
      id: slug,
      name: input.name.trim(),
      description: input.description?.trim() || "No description yet.",
      category: input.category?.trim() || "Custom",
      color: input.color?.trim() || "#e2e8f0",
      mustManned: false,
      autogenStart: "",
      autogenEnd: "",
      regularDays: [],
      regularTimes: [],
      regularTimesByDay: {},
      regularDayWindows: {},
      minPerEmployeePerDay: 0,
      maxPerEmployeePerDay: 0,
      durationMinutes: 0,
      maxConsecutiveMinutes: 0,
      waitingMinutes: 0,
      packingMinutes: 0,
      limitPerDay: 0,
      maxConcurrentPerTimeslot: 0,
      enabled: true,
    },
  });

  return mapLegacyTemplate(created);
}

export async function updateTaskTemplate(
  id: string,
  input: Partial<TaskTemplate>
): Promise<TaskTemplate | null> {
  await ensureAppPersistenceSeeded();
  await ensureDefaultTaskTemplatesSynced();

  const existing = await prisma.appTaskTemplate.findUnique({ where: { id } });
  if (!existing) return null;
  const existingTemplate = mapLegacyTemplate(existing);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.appTaskTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category || null } : {}),
        ...(input.color !== undefined ? { color: input.color || null } : {}),
        ...(input.mustManned !== undefined ? { mustManned: input.mustManned } : {}),
        ...(input.autogenStart !== undefined ? { autogenStart: input.autogenStart || null } : {}),
        ...(input.autogenEnd !== undefined ? { autogenEnd: input.autogenEnd || null } : {}),
        ...(input.regularDays !== undefined ? { regularDays: input.regularDays } : {}),
        ...(input.regularTimes !== undefined ? { regularTimes: input.regularTimes } : {}),
        ...(input.regularTimesByDay !== undefined
          ? { regularTimesByDay: input.regularTimesByDay || {} }
          : {}),
        ...(input.regularDayWindows !== undefined
          ? { regularDayWindows: input.regularDayWindows || {} }
          : {}),
        ...(input.minPerEmployeePerDay !== undefined
          ? { minPerEmployeePerDay: input.minPerEmployeePerDay }
          : {}),
        ...(input.maxPerEmployeePerDay !== undefined
          ? { maxPerEmployeePerDay: input.maxPerEmployeePerDay }
          : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.maxConsecutiveMinutes !== undefined
          ? { maxConsecutiveMinutes: input.maxConsecutiveMinutes }
          : {}),
        ...(input.waitingMinutes !== undefined ? { waitingMinutes: input.waitingMinutes } : {}),
        ...(input.packingMinutes !== undefined ? { packingMinutes: input.packingMinutes } : {}),
        ...(input.limitPerDay !== undefined ? { limitPerDay: input.limitPerDay } : {}),
        ...(input.maxConcurrentPerTimeslot !== undefined
          ? { maxConcurrentPerTimeslot: input.maxConcurrentPerTimeslot }
          : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      },
    });

    const relations = toRelationRows(id, {
      regularDays: input.regularDays ?? existingTemplate.regularDays ?? [],
      regularTimes: input.regularTimes ?? existingTemplate.regularTimes ?? [],
      regularTimesByDay: input.regularTimesByDay ?? existingTemplate.regularTimesByDay ?? {},
      regularDayWindows: input.regularDayWindows ?? existingTemplate.regularDayWindows ?? {},
    });

    await tx.appTaskTemplateRegularDay.deleteMany({ where: { templateId: id } });
    await tx.appTaskTemplateTimeSlot.deleteMany({ where: { templateId: id } });
    await tx.appTaskTemplateDayWindow.deleteMany({ where: { templateId: id } });

    if (relations.regularDayRules.length) {
      await tx.appTaskTemplateRegularDay.createMany({ data: relations.regularDayRules });
    }
    if (relations.timeSlots.length) {
      await tx.appTaskTemplateTimeSlot.createMany({ data: relations.timeSlots });
    }
    if (relations.dayWindows.length) {
      await tx.appTaskTemplateDayWindow.createMany({ data: relations.dayWindows });
    }

    return tx.appTaskTemplate.findUnique({ where: { id } });
  });

  return updated ? mapLegacyTemplate(updated) : null;
}

export async function deleteTaskTemplate(id: string): Promise<boolean> {
  await ensureAppPersistenceSeeded();
  await ensureDefaultTaskTemplatesSynced();

  const deleted = await prisma.appTaskTemplate.deleteMany({ where: { id } });
  return deleted.count > 0;
}
