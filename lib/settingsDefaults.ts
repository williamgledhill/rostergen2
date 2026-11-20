export const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

export type DayHours = { start: string; end: string };
export type AppSettings = {
  hoursByDay: Record<DayKey, DayHours>;
  upcomingDays: number;
  /** Autofill keeps one person's tours at least this many minutes apart where someone else can take one. */
  minTourGapMinutes: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  hoursByDay: {
    Mon: { start: "09:30", end: "16:00" },
    Tue: { start: "09:30", end: "16:00" },
    Wed: { start: "09:30", end: "16:00" },
    Thu: { start: "09:30", end: "16:00" },
    Fri: { start: "09:30", end: "16:00" },
    Sat: { start: "09:30", end: "16:00" },
    Sun: { start: "09:30", end: "16:00" },
  },
  upcomingDays: 7,
  minTourGapMinutes: 60,
};

export const MAX_TOUR_GAP_MINUTES = 240;

export function normalizeMinTourGapMinutes(input: unknown): number {
  const numeric = Number(input);
  if (input === null || input === undefined || input === "" || !Number.isFinite(numeric)) {
    return DEFAULT_SETTINGS.minTourGapMinutes;
  }
  return Math.min(MAX_TOUR_GAP_MINUTES, Math.max(0, Math.round(numeric)));
}
