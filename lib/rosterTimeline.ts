import { SLOT_MINUTES } from "@/lib/taskSegments";

/** Grid row of the first time slot; row 1 holds the employee header. */
export const MIN_ROW = 2;
const DEFAULT_START_MIN = 9 * 60 + 30;
const DEFAULT_END_MIN = 16 * 60;

export function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function formatMinutesToTime(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "09:45" → "9:45", as printed on rosters. */
export function formatShortTime(value: string) {
  return value.replace(/^0(\d)/, "$1");
}

/** "9:30-10:00" style label for a span of the day, in minutes. */
export function formatShortRange(startMin: number, endMin: number) {
  return `${formatShortTime(formatMinutesToTime(startMin))}-${formatShortTime(formatMinutesToTime(endMin))}`;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export type RosterTimeline = {
  dayStartMin: number;
  dayEndMin: number;
  /** Exclusive upper bound for grid rows. */
  maxRowEx: number;
  timeForRow: (row: number) => string;
  timeRangeForSpan: (startRow: number, span: number) => string;
  rowFromTime: (value: string, mode?: "floor" | "ceil") => number | null;
};

/** Maps a day's opening hours onto 15-minute grid rows. */
export function createRosterTimeline(hoursStart?: string, hoursEnd?: string): RosterTimeline {
  const dayStartMin = parseTimeToMinutes(hoursStart) ?? DEFAULT_START_MIN;
  const rawEndMin = parseTimeToMinutes(hoursEnd) ?? DEFAULT_END_MIN;
  const dayEndMin = Math.max(rawEndMin, dayStartMin + 60);
  const totalRows = Math.max(1, Math.floor((dayEndMin - dayStartMin) / SLOT_MINUTES));
  const maxRowEx = MIN_ROW + totalRows;

  const timeForRow = (row: number) => formatMinutesToTime(dayStartMin + (row - MIN_ROW) * SLOT_MINUTES);

  return {
    dayStartMin,
    dayEndMin,
    maxRowEx,
    timeForRow,
    timeRangeForSpan: (startRow, span) => `${timeForRow(startRow)}-${timeForRow(startRow + span)}`,
    rowFromTime: (value, mode = "floor") => {
      const mins = parseTimeToMinutes(value);
      if (mins === null) return null;
      const offset = (mins - dayStartMin) / SLOT_MINUTES;
      return MIN_ROW + (mode === "ceil" ? Math.ceil(offset) : Math.floor(offset));
    },
  };
}
