import fs from "fs";
import path from "path";
import { defaultTaskTemplates, TaskTemplate, slugifyName } from "./taskTemplates";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "taskTemplates.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultTaskTemplates, null, 2), "utf-8");
  }
}

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
    enabled,
  };
}

export function getTaskTemplates(): TaskTemplate[] {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as TaskTemplate[];
    const list = Array.isArray(parsed) && parsed.length ? parsed.map(applyDefaults) : defaultTaskTemplates;
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
    return list;
  } catch {
    return defaultTaskTemplates;
  }
}

export function addTaskTemplate(input: { name: string; description?: string; category?: string; color?: string }): TaskTemplate {
  const templates = getTaskTemplates();
  const baseSlug = slugifyName(input.name);
  let slug = baseSlug;
  let counter = 1;
  while (templates.some((t) => t.id === slug)) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
  const newTemplate: TaskTemplate = {
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
    enabled: true,
  };
  const next = [...templates, newTemplate];
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2), "utf-8");
  return newTemplate;
}

export function updateTaskTemplate(id: string, input: Partial<TaskTemplate>): TaskTemplate | null {
  const templates = getTaskTemplates();
  const idx = templates.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const merged: TaskTemplate = applyDefaults({
    ...templates[idx],
    ...input,
    id,
  });
  const next = [...templates];
  next[idx] = merged;
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2), "utf-8");
  return merged;
}

export function deleteTaskTemplate(id: string): boolean {
  const templates = getTaskTemplates();
  const next = templates.filter((t) => t.id !== id);
  if (next.length === templates.length) return false;
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(next, null, 2), "utf-8");
  return true;
}
