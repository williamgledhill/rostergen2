export function getAutofillTemplatePriority(input: {
  mustManned: boolean;
  hasFixedTimes: boolean;
  minPerEmp: number;
  attendedByAll?: boolean;
  overwriteExistingTasks?: boolean;
}) {
  if (input.attendedByAll && input.hasFixedTimes) return 6;
  if (input.attendedByAll) return 5;
  if (input.mustManned && input.hasFixedTimes) return 5;
  if (input.hasFixedTimes) return 4;
  if (input.mustManned) return 3;
  if (input.minPerEmp > 0) return 2;
  return 1;
}

export function getPreferredConcurrentLimit(
  configuredLimit: number,
  options?: { preferSolo?: boolean }
) {
  if (!options?.preferSolo) return configuredLimit;
  if (!Number.isFinite(configuredLimit) || configuredLimit > 1) return 1;
  return configuredLimit;
}

export function resolveAutofillTimeSlots(input: {
  dayKey: string;
  regularTimes?: string[];
  regularTimesByDay?: Record<string, string[]> | null;
}) {
  const defaultTimes = Array.isArray(input.regularTimes)
    ? input.regularTimes.filter((time): time is string => typeof time === "string")
    : [];
  const regularTimesByDay =
    input.regularTimesByDay &&
    typeof input.regularTimesByDay === "object" &&
    !Array.isArray(input.regularTimesByDay)
      ? input.regularTimesByDay
      : {};
  const dayTimes = Array.isArray(regularTimesByDay[input.dayKey])
    ? regularTimesByDay[input.dayKey].filter((time): time is string => typeof time === "string")
    : [];
  const hasDaySpecificTimes = Object.values(regularTimesByDay).some(
    (times) => Array.isArray(times) && times.length > 0
  );
  const hasAnyFixedTimes = defaultTimes.length > 0 || hasDaySpecificTimes;

  return {
    regularTimes: hasDaySpecificTimes ? dayTimes : defaultTimes,
    hasAnyFixedTimes,
  };
}

export function regularDayAppliesToAutofill(input: {
  dayKey: string;
  regularDays?: string[] | null;
  regularTimes?: string[] | null;
  regularTimesByDay?: Record<string, string[]> | null;
  regularDayWindows?: Record<string, { start?: string; end?: string }> | null;
}) {
  const regularDays = Array.isArray(input.regularDays)
    ? input.regularDays.filter((day): day is string => typeof day === "string")
    : [];
  const regularTimes = Array.isArray(input.regularTimes)
    ? input.regularTimes.filter((time): time is string => typeof time === "string" && time.length > 0)
    : [];
  const regularTimesByDay =
    input.regularTimesByDay &&
    typeof input.regularTimesByDay === "object" &&
    !Array.isArray(input.regularTimesByDay)
      ? input.regularTimesByDay
      : {};
  const dayTimes = Array.isArray(regularTimesByDay[input.dayKey])
    ? regularTimesByDay[input.dayKey].filter((time): time is string => typeof time === "string" && time.length > 0)
    : [];
  const hasDaySpecificTimes = Object.values(regularTimesByDay).some(
    (times) => Array.isArray(times) && times.some((time) => typeof time === "string" && time.length > 0)
  );
  const regularDayWindows =
    input.regularDayWindows &&
    typeof input.regularDayWindows === "object" &&
    !Array.isArray(input.regularDayWindows)
      ? input.regularDayWindows
      : {};
  const dayWindow = regularDayWindows[input.dayKey];
  const hasDayWindow =
    !!dayWindow &&
    ((typeof dayWindow.start === "string" && dayWindow.start.length > 0) ||
      (typeof dayWindow.end === "string" && dayWindow.end.length > 0));

  if (hasDaySpecificTimes) {
    return dayTimes.length > 0 || hasDayWindow;
  }

  return regularDays.includes(input.dayKey) || regularTimes.length > 0 || hasDayWindow;
}

export function isAutofillFillerTemplate(input: {
  hasFixedTimes: boolean;
  mustManned: boolean;
  minPerEmp: number;
  fixedTimeBlock?: boolean;
}) {
  return !input.hasFixedTimes && !input.mustManned && input.minPerEmp <= 0 && !input.fixedTimeBlock;
}

export function isAutofillMinimumTemplate(input: {
  mustManned: boolean;
  minPerEmp: number;
  attendedByAll?: boolean;
  overwriteExistingTasks?: boolean;
}) {
  return !input.mustManned && input.minPerEmp > 0 && !input.attendedByAll && !input.overwriteExistingTasks;
}

export function getAutofillTaskRole(input: {
  hasFixedTimes: boolean;
  mustManned: boolean;
  minPerEmp: number;
  fixedTimeBlock?: boolean;
  attendedByAll?: boolean;
  overwriteExistingTasks?: boolean;
}): "attended" | "override" | "minimum" | "coverage" | "fixed" | "filler" {
  if (input.attendedByAll) return "attended";
  if (input.overwriteExistingTasks) return "override";
  if (isAutofillMinimumTemplate(input)) return "minimum";
  if (input.mustManned) return "coverage";
  if (input.hasFixedTimes || input.fixedTimeBlock) return "fixed";
  return "filler";
}

export function resolveAutofillPlacementSpan(input: {
  baseSpan: number;
  availableSpan: number;
  allowShrink: boolean;
  minSpan?: number;
  maxConsecutiveSpan?: number;
  fillerChunkSpan?: number;
}) {
  if (!Number.isFinite(input.baseSpan) || input.baseSpan <= 0) return 0;
  if (!Number.isFinite(input.availableSpan) || input.availableSpan <= 0) return 0;

  let span = input.allowShrink
    ? Math.max(1, Math.min(input.baseSpan, input.availableSpan))
    : input.baseSpan;

  if (Number.isFinite(input.maxConsecutiveSpan) && (input.maxConsecutiveSpan ?? 0) > 0) {
    span = Math.min(span, input.maxConsecutiveSpan as number);
  }
  if (Number.isFinite(input.fillerChunkSpan) && (input.fillerChunkSpan ?? 0) > 0) {
    span = Math.min(span, input.fillerChunkSpan as number);
  }

  const minSpan = Math.max(1, input.minSpan ?? 1);
  if (span < minSpan || span > input.availableSpan) return 0;
  return span;
}

export type AutofillPlacementWindow = {
  startRow: number;
  endRow: number;
};

export type AutofillOccupiedRange = {
  startRow: number;
  span: number;
};

export type AutofillTaskFragment = {
  startRow: number;
  span: number;
  waitingMinutes?: number;
  packingMinutes?: number;
};

function overlapsRange(range: AutofillOccupiedRange, startRow: number, span: number) {
  return startRow < range.startRow + range.span && startRow + span > range.startRow;
}

function getTaskSegmentRows(task: AutofillTaskFragment) {
  const totalRows = Math.max(1, task.span);
  const waitingRows = Math.max(0, Math.round((task.waitingMinutes ?? 0) / 15));
  const packingRows = Math.max(0, Math.round((task.packingMinutes ?? 0) / 15));
  const safeWaiting = Math.min(waitingRows, totalRows - 1);
  const safePacking = Math.min(packingRows, totalRows - safeWaiting - 1);
  const mainRows = Math.max(1, totalRows - safeWaiting - safePacking);
  return { waitingRows: safeWaiting, mainRows, packingRows: safePacking };
}

function toFragment(startRow: number, kinds: Array<"waiting" | "main" | "packing">): AutofillTaskFragment | null {
  if (!kinds.length) return null;

  let waitingRows = 0;
  while (waitingRows < kinds.length && kinds[waitingRows] === "waiting") {
    waitingRows += 1;
  }

  let packingRows = 0;
  while (packingRows < kinds.length - waitingRows && kinds[kinds.length - 1 - packingRows] === "packing") {
    packingRows += 1;
  }

  const mainRows = kinds.length - waitingRows - packingRows;
  if (mainRows <= 0) return null;

  return {
    startRow,
    span: kinds.length,
    waitingMinutes: waitingRows * 15,
    packingMinutes: packingRows * 15,
  };
}

export function clipTaskAroundBlockedRange(
  task: AutofillTaskFragment,
  blockedRange: AutofillOccupiedRange
) {
  if (!overlapsRange(blockedRange, task.startRow, task.span)) return [task];

  const taskEnd = task.startRow + task.span;
  const blockStart = Math.max(task.startRow, blockedRange.startRow);
  const blockEnd = Math.min(taskEnd, blockedRange.startRow + blockedRange.span);

  const { waitingRows, mainRows, packingRows } = getTaskSegmentRows(task);
  const kinds: Array<"waiting" | "main" | "packing"> = [
    ...Array.from({ length: waitingRows }, () => "waiting" as const),
    ...Array.from({ length: mainRows }, () => "main" as const),
    ...Array.from({ length: packingRows }, () => "packing" as const),
  ];

  const beforeKinds = kinds.slice(0, Math.max(0, blockStart - task.startRow));
  const afterKinds = kinds.slice(Math.max(0, blockEnd - task.startRow));

  return [
    toFragment(task.startRow, beforeKinds),
    toFragment(blockEnd, afterKinds),
  ].filter((fragment): fragment is AutofillTaskFragment => fragment !== null);
}

export function getFeasiblePlacementRows(input: {
  candidateRows: number[];
  span: number;
  employeeWindow?: AutofillPlacementWindow | null;
  occupiedRanges?: AutofillOccupiedRange[];
  blockedRange?: AutofillOccupiedRange | null;
}) {
  if (!Number.isFinite(input.span) || input.span <= 0) return [];

  const occupiedRanges = input.occupiedRanges ?? [];

  return input.candidateRows.filter((row) => {
    if (!Number.isFinite(row)) return false;

    const endRow = row + input.span;
    if (input.employeeWindow) {
      if (row < input.employeeWindow.startRow || endRow > input.employeeWindow.endRow) {
        return false;
      }
    }

    if (input.blockedRange && overlapsRange(input.blockedRange, row, input.span)) {
      return false;
    }

    return !occupiedRanges.some((range) => overlapsRange(range, row, input.span));
  });
}

function summarizeFutureAvailability(counts: number[]) {
  return {
    blockedTemplates: counts.filter((count) => count <= 0).length,
    tightestTemplate: counts.length ? Math.min(...counts) : Number.POSITIVE_INFINITY,
    totalOptions: counts.reduce((sum, count) => sum + Math.max(0, count), 0),
  };
}

export function compareFutureMinimumAvailability(aCounts: number[], bCounts: number[]) {
  const a = summarizeFutureAvailability(aCounts);
  const b = summarizeFutureAvailability(bCounts);

  if (a.blockedTemplates !== b.blockedTemplates) {
    return a.blockedTemplates - b.blockedTemplates;
  }
  if (a.tightestTemplate !== b.tightestTemplate) {
    return b.tightestTemplate - a.tightestTemplate;
  }
  if (a.totalOptions !== b.totalOptions) {
    return b.totalOptions - a.totalOptions;
  }
  return 0;
}
