import { AppDayOfWeek } from "@prisma/client";
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
    next[day] = start >= end ? { ...DEFAULT_SETTINGS.hoursByDay[day] } : { start, end };
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

function rowsToHoursByDay(
  rows: Array<{ dayOfWeek: AppDayOfWeek; start: string; end: string }>
): Record<DayKey, DayHours> {
  const hoursByDay = { ...DEFAULT_SETTINGS.hoursByDay };
  rows.forEach((row) => {
    hoursByDay[row.dayOfWeek as DayKey] = {
      start: row.start,
      end: row.end,
    };
  });
  return normalizeHoursByDay(hoursByDay);
}

function toDayHourRows(hoursByDay: Record<DayKey, DayHours>) {
  return DAY_KEYS.map((day) => ({
    dayOfWeek: day,
    start: hoursByDay[day].start,
    end: hoursByDay[day].end,
  }));
}

export async function getSettings(): Promise<AppSettings> {
  await ensureAppPersistenceSeeded();

  const record = await prisma.appSettings.findUnique({
    where: { id: "default" },
    include: { dayHours: true },
  });
  return {
    hoursByDay: record?.dayHours.length
      ? rowsToHoursByDay(record.dayHours)
      : normalizeHoursByDay(record?.hoursByDay),
    upcomingDays: normalizeUpcomingDays(record?.upcomingDays),
  };
}

export async function saveSettings(input: AppSettings): Promise<AppSettings> {
  await ensureAppPersistenceSeeded();

  const normalized = {
    hoursByDay: normalizeHoursByDay(input?.hoursByDay),
    upcomingDays: normalizeUpcomingDays(input?.upcomingDays),
  };

  await prisma.$transaction(async (tx) => {
    await tx.appSettings.upsert({
      where: { id: "default" },
      update: {
        hoursByDay: normalized.hoursByDay as never,
        upcomingDays: normalized.upcomingDays,
      },
      create: {
        id: "default",
        hoursByDay: normalized.hoursByDay as never,
        upcomingDays: normalized.upcomingDays,
      },
    });

    await tx.appSettingsDayHours.deleteMany({ where: { settingsId: "default" } });
    await tx.appSettingsDayHours.createMany({
      data: toDayHourRows(normalized.hoursByDay).map((row) => ({
        settingsId: "default",
        ...row,
      })),
    });
  });

  return normalized;
}
