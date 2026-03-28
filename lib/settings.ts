import { prisma } from "./prisma";
import { ensureAppPersistenceSeeded } from "./appPersistenceSeed";
import { DAY_KEYS, DEFAULT_SETTINGS, AppSettings, DayKey, DayHours } from "./settingsDefaults";

function isValidTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function normalizeHoursByDay(input: any): Record<DayKey, DayHours> {
  const next: Record<DayKey, DayHours> = { ...DEFAULT_SETTINGS.hoursByDay };
  DAY_KEYS.forEach((day) => {
    const candidate = input?.[day];
    const start = isValidTime(candidate?.start) ? candidate.start : next[day].start;
    const end = isValidTime(candidate?.end) ? candidate.end : next[day].end;
    if (start >= end) {
      next[day] = { ...DEFAULT_SETTINGS.hoursByDay[day] };
    } else {
      next[day] = { start, end };
    }
  });
  return next;
}

function normalizeUpcomingDays(input: unknown): number {
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) return DEFAULT_SETTINGS.upcomingDays;
  const rounded = Math.floor(numeric);
  if (rounded < 1) return 1;
  if (rounded > 90) return 90;
  return rounded;
}

export async function getSettings(): Promise<AppSettings> {
  await ensureAppPersistenceSeeded();

  const record = await prisma.appSettings.findUnique({ where: { id: "default" } });
  return {
    hoursByDay: normalizeHoursByDay(record?.hoursByDay),
    upcomingDays: normalizeUpcomingDays(record?.upcomingDays),
  };
}

export async function saveSettings(input: AppSettings): Promise<AppSettings> {
  await ensureAppPersistenceSeeded();

  const normalized = {
    hoursByDay: normalizeHoursByDay(input?.hoursByDay),
    upcomingDays: normalizeUpcomingDays(input?.upcomingDays),
  };

  await prisma.appSettings.upsert({
    where: { id: "default" },
    update: normalized,
    create: { id: "default", ...normalized },
  });

  return normalized;
}
