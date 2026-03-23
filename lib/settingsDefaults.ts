export const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export type DayHours = { start: string; end: string };
export type AppSettings = {
  hoursByDay: Record<DayKey, DayHours>;
  upcomingDays: number;
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
};
