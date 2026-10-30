import { regularDayAppliesToAutofill, resolveAutofillTimeSlots } from "@/lib/rosterAutofill";
import { MIN_ROW, clampNumber, type RosterTimeline } from "@/lib/rosterTimeline";
import { SLOT_MINUTES } from "@/lib/taskSegments";
import type { TaskTemplate } from "@/lib/taskTemplates";

export type RowWindow = { startRow: number; endRow: number };

/** A task template resolved against one roster day's grid. */
export type TemplateMeta = {
  id: string;
  template: TaskTemplate;
  span: number;
  minSpan: number;
  waitingMinutes: number;
  /** Rows of the lead-in an all-staff task or sole must-be-manned cover may keep instead. */
  coverableWaitingRows: number;
  packingMinutes: number;
  /** Earliest start to latest end across the day's time ranges. */
  window: RowWindow | null;
  /** The separate time ranges it may run in; blocks never cross the gaps between them. */
  windows: RowWindow[];
  regularTimeRows: number[];
  hasFixedTimes: boolean;
  limitPerDay: number;
  maxPerEmp: number;
  minPerEmp: number;
  mustManned: boolean;
  overwriteExistingTasks: boolean;
  attendedByAll: boolean;
  /** Tasks without a set duration may be shortened to fit a gap. */
  allowShrink: boolean;
  maxConsecutiveSpan: number;
  maxConcurrentPerTimeslot: number;
  /** Placed up front at set times before anything flexible is scheduled. */
  fixedTimeBlock: boolean;
  /** The main body of these tasks may overwrite other work but never another protected task. */
  protectsTourWindow: boolean;
};

/** People rotate off a task without a set length after this long, unless it sets its own limit. */
export const DEFAULT_STINT_MINUTES = 60;

const positiveOr = (value: number | undefined, fallback: number) => (value && value > 0 ? value : fallback);

function toRowWindow(startValue: string, endValue: string, timeline: RosterTimeline): RowWindow | null {
  const { maxRowEx, rowFromTime } = timeline;
  let startRow = MIN_ROW;
  let endRow = maxRowEx;
  if (startValue) {
    const row = rowFromTime(startValue, "floor");
    if (row !== null) startRow = clampNumber(row, MIN_ROW, maxRowEx - 1);
  }
  if (endValue) {
    const row = rowFromTime(endValue, "ceil");
    if (row !== null) endRow = clampNumber(row, MIN_ROW + 1, maxRowEx);
  }
  if (endRow <= startRow) return null;
  return { startRow, endRow };
}

function getTemplateWindows(template: TaskTemplate, dayKey: string, timeline: RosterTimeline): RowWindow[] {
  const dayWindow = template.regularDayWindows?.[dayKey];
  const extras = Array.isArray(template.extraDayWindows?.[dayKey]) ? template.extraDayWindows![dayKey] : [];
  // Further ranges with a missing start or end are ignored, so a half-typed range can't open up the whole day.
  const others = extras
    .filter((range) => range?.start && range?.end)
    .map((range) => toRowWindow(range.start!, range.end!, timeline));
  const startValue = dayWindow?.start || template.autogenStart || "";
  const endValue = dayWindow?.end || template.autogenEnd || "";
  // With no first range but other ranges set, the task runs only in those, not all day.
  const first = startValue || endValue || !others.length ? toRowWindow(startValue, endValue, timeline) : null;
  const windows = [first, ...others]
    .filter((window): window is RowWindow => !!window)
    .sort((a, b) => a.startRow - b.startRow);

  // Overlapping or touching ranges join into one.
  const merged: RowWindow[] = [];
  for (const window of windows) {
    const last = merged[merged.length - 1];
    if (last && window.startRow <= last.endRow) last.endRow = Math.max(last.endRow, window.endRow);
    else merged.push({ ...window });
  }
  return merged;
}

/** End of the time range the row falls in, or null when the row is between ranges. */
export function windowEndAt(meta: Pick<TemplateMeta, "windows">, row: number) {
  return meta.windows.find((window) => row >= window.startRow && row < window.endRow)?.endRow ?? null;
}

export function templateAppliesOnDay(template: TaskTemplate, dayKey: string) {
  return regularDayAppliesToAutofill({
    dayKey,
    regularDays: template.regularDays,
    regularTimes: template.regularTimes,
    regularTimesByDay: template.regularTimesByDay,
    regularDayWindows: template.regularDayWindows,
  });
}

export function buildTemplateMeta(
  template: TaskTemplate,
  dayKey: string,
  timeline: RosterTimeline
): TemplateMeta | null {
  const { maxRowEx, rowFromTime } = timeline;
  const windows = getTemplateWindows(template, dayKey, timeline);
  if (!windows.length) return null;
  const window: RowWindow = { startRow: windows[0].startRow, endRow: windows[windows.length - 1].endRow };

  const hasDuration = Number.isFinite(template.durationMinutes) && (template.durationMinutes ?? 0) > 0;
  const baseDuration = hasDuration ? (template.durationMinutes as number) : 60;
  const waitingMinutes = template.waitingMinutes || 0;
  const packingMinutes = template.packingMinutes || 0;
  const totalMinutes = Math.max(SLOT_MINUTES, baseDuration + waitingMinutes + packingMinutes);
  const waitingRows = Math.max(0, Math.round(waitingMinutes / SLOT_MINUTES));
  const packingRows = Math.max(0, Math.round(packingMinutes / SLOT_MINUTES));
  const allowShrink = !hasDuration && waitingMinutes === 0 && packingMinutes === 0;
  const minSpanForSegments = Math.max(1, waitingRows + packingRows + 1);
  const span = Math.max(Math.ceil(totalMinutes / SLOT_MINUTES), minSpanForSegments);

  const maxConsecutiveMinutes = Number.isFinite(template.maxConsecutiveMinutes)
    ? Number(template.maxConsecutiveMinutes)
    : 0;
  const stintMinutes = maxConsecutiveMinutes > 0 ? maxConsecutiveMinutes : allowShrink ? DEFAULT_STINT_MINUTES : 0;
  const configuredConsecutiveSpan = stintMinutes > 0 ? Math.max(1, Math.ceil(stintMinutes / SLOT_MINUTES)) : 0;
  // One block of a fixed-length task is always allowed, even if it (with its
  // waiting time) runs longer than the "time in one go" limit.
  const maxConsecutiveSpan =
    configuredConsecutiveSpan > 0 && !allowShrink ? Math.max(configuredConsecutiveSpan, span) : configuredConsecutiveSpan;
  const minPerEmp = positiveOr(template.minPerEmployeePerDay, 0);

  const regularTimesByDay =
    template.regularTimesByDay && typeof template.regularTimesByDay === "object" && !Array.isArray(template.regularTimesByDay)
      ? template.regularTimesByDay
      : {};
  const timeSlotConfig = resolveAutofillTimeSlots({
    dayKey,
    regularTimes: Array.isArray(template.regularTimes) ? template.regularTimes : [],
    regularTimesByDay,
  });
  // A listed time marks when the main body starts, so the waiting lead-in begins earlier.
  const regularTimeRows = timeSlotConfig.regularTimes
    .map((time) => {
      const mainRow = rowFromTime(time, "floor");
      return mainRow === null ? null : mainRow - waitingRows;
    })
    .filter((row): row is number => row !== null)
    .filter((row) => windows.some((range) => row >= range.startRow && row + span <= range.endRow));

  const hasBoundedWindow = window.startRow > MIN_ROW || window.endRow < maxRowEx;
  const windowRows = window.endRow - window.startRow;
  const fixedTimeBlock =
    regularTimeRows.length > 0 ||
    (hasBoundedWindow &&
      minPerEmp === 0 &&
      !allowShrink &&
      (windowRows <= span || !!template.mustManned || !!template.attendedByAll || !!template.overwriteExistingTasks));

  return {
    id: template.id || template.name || "task",
    template,
    span,
    minSpan: minSpanForSegments,
    waitingMinutes,
    coverableWaitingRows: template.waitingCanBeCovered ? waitingRows : 0,
    packingMinutes,
    window,
    windows,
    regularTimeRows: Array.from(new Set(regularTimeRows)).sort((a, b) => a - b),
    hasFixedTimes: timeSlotConfig.hasAnyFixedTimes,
    limitPerDay: positiveOr(template.limitPerDay, Number.POSITIVE_INFINITY),
    maxPerEmp: positiveOr(template.maxPerEmployeePerDay, Number.POSITIVE_INFINITY),
    minPerEmp,
    mustManned: !!template.mustManned,
    overwriteExistingTasks: !!template.overwriteExistingTasks,
    attendedByAll: !!template.attendedByAll,
    allowShrink,
    maxConsecutiveSpan,
    maxConcurrentPerTimeslot: positiveOr(template.maxConcurrentPerTimeslot, Number.POSITIVE_INFINITY),
    fixedTimeBlock,
    protectsTourWindow: !!template.mustManned && !!template.overwriteExistingTasks,
  };
}
