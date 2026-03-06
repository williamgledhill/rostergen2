import fs from "fs";
import path from "path";
import { DAY_KEYS, DEFAULT_SETTINGS, AppSettings, DayKey, DayHours } from "./settingsDefaults";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "settings.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf-8");
  }
}

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

export function getSettings(): AppSettings {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      hoursByDay: normalizeHoursByDay(parsed?.hoursByDay),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(input: AppSettings): AppSettings {
  const normalized = {
    hoursByDay: normalizeHoursByDay(input?.hoursByDay),
  };
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2), "utf-8");
  return normalized;
}
