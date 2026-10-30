import { getDayScheduleForDate, type Person } from "@/lib/people";
import {
  compareFutureMinimumAvailability,
  getAutofillTemplatePriority,
  getFeasiblePlacementRows,
  getPreferredConcurrentLimit,
  isAutofillFillerTemplate,
  isAutofillMinimumTemplate,
  resolveAutofillPlacementSpan,
} from "@/lib/rosterAutofill";
import { isMergeableTask, mergeAdjacentTasks, schoolTourLabel, sortSchoolTours } from "@/lib/rosterGrid";
import { MIN_ROW, clampNumber, parseTimeToMinutes, type RosterTimeline } from "@/lib/rosterTimeline";
import {
  FIRST_EMPLOYEE_COL,
  createId as defaultCreateId,
  type AutofillNotice,
  type GridTask,
  type RosterEmployee,
  type SchoolTourEntry,
} from "@/lib/rosterTypes";
import { SLOT_MINUTES, getTaskSegmentRows } from "@/lib/taskSegments";
import { isTourTemplate, type TaskTemplate } from "@/lib/taskTemplates";
import { PlacementBoard, rangesOverlap, type RowRange } from "./placementBoard";
import { buildTemplateMeta, templateAppliesOnDay, windowEndAt, type RowWindow, type TemplateMeta } from "./templateMeta";

export type AutofillInput = {
  employees: RosterEmployee[];
  people: Person[];
  templates: TaskTemplate[];
  schoolTours: SchoolTourEntry[];
  rosterDate: Date;
  timeline: RosterTimeline;
  /** Rotates tie-breaks so pressing Autofill again gives a different, equally valid roster. */
  variant: number;
  createId?: () => string;
};

export type AutofillResult = {
  tasks: GridTask[];
  /** `undefined` means there was nothing to schedule and any existing notice should stay. */
  notice?: AutofillNotice | null;
};

type EmployeeId = string | number;

type CoverageAvailability = {
  blockedRows: number;
  tightestCoverage: number;
  totalOptions: number;
};

type PlacementCandidate = {
  meta: TemplateMeta;
  emp: RosterEmployee;
  row: number;
  span: number;
  col: number;
  futureAvailability: number[];
  coverageAvailability: CoverageAvailability;
  activeCount: number;
  empCount: number;
  totalCount: number;
  centerDistance: number;
  transitionPenalty: number;
  gapPenalty: number;
  rowRank: number;
};

type PlacementOptions = {
  /** Minimum-per-employee templates still to be scheduled after this one. */
  futureMinimumMetas?: TemplateMeta[];
  /** Must-be-manned templates whose cover this placement should not starve. */
  coverageMetas?: TemplateMeta[];
  concurrentLimit?: number;
  /** Lets a stint run past the task's time-in-one-go limit, as a last resort for cover. */
  ignoreConsecutiveLimit?: boolean;
};

const DAY_KEYS_BY_WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_TASK_COLOR = "#e2e8f0";

function getRotatedRank(index: number, total: number, offset: number) {
  if (total <= 0) return 0;
  const normalizedOffset = ((offset % total) + total) % total;
  return (index - normalizedOffset + total) % total;
}

function compareCoverageAvailability(a: CoverageAvailability, b: CoverageAvailability) {
  if (a.blockedRows !== b.blockedRows) return a.blockedRows - b.blockedRows;
  if (a.tightestCoverage !== b.tightestCoverage) return b.tightestCoverage - a.tightestCoverage;
  if (a.totalOptions !== b.totalOptions) return b.totalOptions - a.totalOptions;
  return 0;
}

function rowsBetween(startRow: number, endRow: number) {
  return Array.from({ length: Math.max(0, endRow - startRow) }, (_, index) => startRow + index);
}

/**
 * Builds a full day's roster from the task templates. Placement runs in passes:
 * imported school tours, fixed-time blocks, per-employee minimums, must-be-manned
 * cover, other scheduled tasks, all-hands and overriding tasks, then fillers in
 * whatever gaps remain.
 */
export function generateAutofillRoster(input: AutofillInput): AutofillResult {
  const { employees, people, templates, schoolTours, rosterDate, timeline, variant } = input;
  const { maxRowEx, rowFromTime, timeRangeForSpan } = timeline;
  if (!employees.length) return { tasks: [] };

  const dayKey = DAY_KEYS_BY_WEEKDAY[rosterDate.getDay()];
  const board = new PlacementBoard(input.createId ?? defaultCreateId);
  const templateById = new Map(templates.map((template) => [template.id, template]));
  const colorForType = (type: string) => templateById.get(type)?.color || DEFAULT_TASK_COLOR;

  // ---- Paired tasks ----
  // A task that goes with another (like admin straight after a break) isn't
  // scheduled on its own: it's placed beside every block of that task instead.

  const isPairedTemplate = (template: TaskTemplate) =>
    !!template.pairedWithTaskId && template.pairedWithTaskId !== template.id && templateById.has(template.pairedWithTaskId);
  const pairedMetasByAnchor = new Map<string, TemplateMeta[]>();
  for (const template of templates) {
    if (template.enabled === false || !isPairedTemplate(template)) continue;
    // It runs whenever its partner does, so its own days and time range don't apply.
    const meta = buildTemplateMeta(
      { ...template, regularDayWindows: {}, extraDayWindows: {}, autogenStart: "", autogenEnd: "" },
      dayKey,
      timeline
    );
    if (!meta) continue;
    const anchorId = template.pairedWithTaskId!;
    pairedMetasByAnchor.set(anchorId, [...(pairedMetasByAnchor.get(anchorId) ?? []), meta]);
  }
  /** Tasks placed alongside each anchor block, so they can be undone together. */
  const pairedTasksByAnchor = new Map<GridTask["id"], { meta: TemplateMeta; task: GridTask }[]>();

  const pairedSpan = (meta: TemplateMeta) => (meta.allowShrink && meta.maxConsecutiveSpan > 0 ? meta.maxConsecutiveSpan : meta.span);

  /** Where the tasks that go with this one sit around a block of it. */
  const getPairedRanges = (meta: TemplateMeta, range: RowRange) => {
    let before = range.startRow;
    let after = range.startRow + range.span;
    return (pairedMetasByAnchor.get(meta.id) ?? []).map((paired) => {
      const span = pairedSpan(paired);
      if (paired.template.pairedPosition === "before") {
        before -= span;
        return { meta: paired, range: { startRow: before, span } };
      }
      const pairedRange = { startRow: after, span };
      after += span;
      return { meta: paired, range: pairedRange };
    });
  };

  const pairedRowsAfter = (meta: TemplateMeta) =>
    (pairedMetasByAnchor.get(meta.id) ?? [])
      .filter((paired) => paired.template.pairedPosition !== "before")
      .reduce((sum, paired) => sum + pairedSpan(paired), 0);

  // ---- Employees ----

  const employeeColById = new Map(employees.map((emp, index) => [emp.id, index + FIRST_EMPLOYEE_COL]));
  const employeeOrder = new Map(employees.map((emp, index) => [emp.id, index]));
  const peopleById = new Map(people.map((person) => [String(person.id), person]));
  const peopleByName = new Map(people.map((person) => [person.name.toLowerCase(), person]));
  const employeeWindows = new Map<EmployeeId, RowWindow | null>();
  const fullDay: RowWindow = { startRow: MIN_ROW, endRow: maxRowEx };

  const colOf = (emp: RosterEmployee) => employeeColById.get(emp.id)!;
  const compareRotation = (a: RosterEmployee, b: RosterEmployee) =>
    getRotatedRank(employeeOrder.get(a.id) ?? 0, employees.length, variant) -
    getRotatedRank(employeeOrder.get(b.id) ?? 0, employees.length, variant);

  const resolveEmployeeWindow = (emp: RosterEmployee): RowWindow | null => {
    const overrideStart = parseTimeToMinutes(emp.startTime);
    const overrideEnd = parseTimeToMinutes(emp.endTime);
    if (overrideStart !== null && overrideEnd !== null && overrideStart < overrideEnd) {
      const startRaw = rowFromTime(emp.startTime as string, "ceil");
      const endRaw = rowFromTime(emp.endTime as string, "floor");
      if (startRaw !== null && endRaw !== null) {
        const startRow = clampNumber(startRaw, MIN_ROW, maxRowEx - 1);
        const endRow = clampNumber(endRaw, MIN_ROW + 1, maxRowEx);
        if (endRow > startRow) return { startRow, endRow };
      }
    }

    const person = peopleById.get(String(emp.id)) || peopleByName.get(String(emp.name || "").toLowerCase());
    // Employees who aren't saved people have no schedule, so they cover the whole day.
    if (!person) return fullDay;
    const schedule = getDayScheduleForDate(person, rosterDate);
    if (!schedule.enabled) return null;
    const startRaw = rowFromTime(schedule.start, "ceil");
    const endRaw = rowFromTime(schedule.end, "floor");
    if (startRaw === null || endRaw === null) return null;
    const startRow = clampNumber(startRaw, MIN_ROW, maxRowEx - 1);
    const endRow = clampNumber(endRaw, MIN_ROW + 1, maxRowEx);
    return endRow > startRow ? { startRow, endRow } : null;
  };

  /** Rows the employee is working, or null when they are off. */
  const getEmployeeWindow = (emp: RosterEmployee) => {
    if (!employeeWindows.has(emp.id)) employeeWindows.set(emp.id, resolveEmployeeWindow(emp));
    return employeeWindows.get(emp.id)!;
  };

  const isWithinShift = (emp: RosterEmployee, range: RowRange) => {
    const window = getEmployeeWindow(emp);
    return !!window && range.startRow >= window.startRow && range.startRow + range.span <= window.endRow;
  };

  /**
   * The employee is on shift for the whole range and their column is empty there,
   * along with room for any tasks that go with the template.
   */
  const isFree = (emp: RosterEmployee, range: RowRange, meta?: TemplateMeta): boolean =>
    isWithinShift(emp, range) &&
    board.isRangeFree(colOf(emp), range) &&
    (!meta || getPairedRanges(meta, range).every((paired) => isFree(emp, paired.range)));

  const getEligibleEmployeesForRow = (row: number, span: number) =>
    employees.filter((emp) => isWithinShift(emp, { startRow: row, span }));

  // ---- Template limits ----

  const exceedsConsecutiveLimit = (meta: TemplateMeta, col: number, range: RowRange) =>
    meta.maxConsecutiveSpan > 0 && board.consecutiveSpan(col, meta.id, range) > meta.maxConsecutiveSpan;

  /** The employee could take this placement without breaking any limit of the template. */
  const canTakePlacement = (
    meta: TemplateMeta,
    emp: RosterEmployee,
    range: RowRange,
    concurrentLimit = meta.maxConcurrentPerTimeslot
  ) =>
    board.getEmpCount(meta.id, emp.id) < meta.maxPerEmp &&
    isFree(emp, range, meta) &&
    !board.exceedsConcurrentLimit(meta.id, range, concurrentLimit) &&
    !exceedsConsecutiveLimit(meta, colOf(emp), range);

  /** Largest span the template can take starting at the row, or 0 when it doesn't fit. */
  const spanAt = (meta: TemplateMeta, row: number, endRow = meta.window?.endRow ?? maxRowEx) =>
    resolveAutofillPlacementSpan({
      baseSpan: meta.span,
      // Blocks stay inside the time range the row is in, never crossing into a gap between ranges.
      availableSpan: Math.min(endRow, windowEndAt(meta, row) ?? row, maxRowEx) - row,
      allowShrink: meta.allowShrink,
      minSpan: meta.minSpan,
      maxConsecutiveSpan: meta.maxConsecutiveSpan,
    });

  const getCandidateRowsForMeta = (meta: TemplateMeta) => {
    if (!meta.window) return [];
    if (meta.regularTimeRows.length > 0) return meta.regularTimeRows;
    if (meta.hasFixedTimes) return [];
    return rowsBetween(meta.window.startRow, meta.window.endRow).filter((row) => spanAt(meta, row) > 0);
  };

  const getDesiredPlacements = (meta: TemplateMeta, candidateRows: number[]) => {
    let desiredCount = 1;
    if (meta.hasFixedTimes || meta.mustManned) {
      desiredCount = candidateRows.length;
    } else if (Number.isFinite(meta.template.limitPerDay) && (meta.template.limitPerDay ?? 0) > 0) {
      desiredCount = meta.template.limitPerDay as number;
    } else if (meta.minPerEmp > 0) {
      desiredCount = meta.minPerEmp * employees.length;
    }
    return Math.min(desiredCount, meta.limitPerDay);
  };

  const isMinimumMeta = (meta: TemplateMeta) =>
    isAutofillMinimumTemplate({
      mustManned: meta.mustManned,
      minPerEmp: meta.minPerEmp,
      attendedByAll: meta.attendedByAll,
      overwriteExistingTasks: meta.overwriteExistingTasks,
    });

  // ---- Protected tasks ----
  // Must-be-manned tasks that overwrite others (tours) protect their main body:
  // nothing else may be placed over it, though their buffers can be shared.

  const getProtectedRangeForMeta = (meta: TemplateMeta, startRow: number, span: number): RowRange => {
    if (!meta.protectsTourWindow) return { startRow, span };
    const { waitingRows, mainRows } = getTaskSegmentRows({
      span,
      waitingMinutes: meta.waitingMinutes,
      packingMinutes: meta.packingMinutes,
    });
    return { startRow: startRow + waitingRows, span: mainRows };
  };

  const getSupportRangesForProtectedMeta = (meta: TemplateMeta, startRow: number, span: number) => {
    if (!meta.protectsTourWindow) return [];
    const { waitingRows, mainRows, packingRows } = getTaskSegmentRows({
      span,
      waitingMinutes: meta.waitingMinutes,
      packingMinutes: meta.packingMinutes,
    });
    const ranges: RowRange[] = [];
    if (waitingRows > 0) ranges.push({ startRow, span: waitingRows });
    if (packingRows > 0) ranges.push({ startRow: startRow + waitingRows + mainRows, span: packingRows });
    return ranges;
  };

  const getProtectedRangeForTask = (task: GridTask): RowRange | null => {
    const template = templateById.get(task.type);
    if (!template || !template.mustManned || !template.overwriteExistingTasks) return null;
    const { waitingRows, mainRows } = getTaskSegmentRows({
      span: task.span,
      waitingMinutes: task.waitingMinutes ?? template.waitingMinutes,
      packingMinutes: task.packingMinutes ?? template.packingMinutes,
    });
    return { startRow: task.startRow + waitingRows, span: mainRows };
  };

  const isProtectedMinimumTask = (task: GridTask) => {
    const template = templateById.get(task.type);
    if (!template) return false;
    return isAutofillMinimumTemplate({
      mustManned: !!template.mustManned,
      minPerEmp: Number(template.minPerEmployeePerDay) || 0,
      attendedByAll: !!template.attendedByAll,
      overwriteExistingTasks: !!template.overwriteExistingTasks,
    });
  };

  /** Label of a protected task in the column that overlaps the range, if any. */
  const getProtectedTaskConflict = (col: number, blockedRange: RowRange) => {
    const task = board.column(col).find((entry) => {
      const protectedRange = getProtectedRangeForTask(entry);
      return protectedRange ? rangesOverlap(blockedRange, protectedRange) : false;
    });
    return task ? `${task.label} ${timeRangeForSpan(task.startRow, task.span)}` : null;
  };

  const hasProtectedMinimumConflict = (col: number, blockedRange: RowRange) =>
    board.column(col).some((task) => isProtectedMinimumTask(task) && rangesOverlap(blockedRange, task));

  /** Prefers columns where the placement sits right next to a protected task. */
  const getProtectedAdjacencyScore = (col: number, range: RowRange) => {
    const endRow = range.startRow + range.span;
    let score = 0;
    for (const task of board.column(col)) {
      const protectedRange = getProtectedRangeForTask(task);
      if (!protectedRange) continue;
      const protectedEnd = protectedRange.startRow + protectedRange.span;
      if (protectedEnd === range.startRow || protectedRange.startRow === endRow) score += 1000;
      const gap =
        protectedEnd <= range.startRow
          ? range.startRow - protectedEnd
          : protectedRange.startRow >= endRow
            ? protectedRange.startRow - endRow
            : 0;
      score += Math.max(0, 8 - gap);
    }
    return score;
  };

  // ---- Sharing tours out ----
  // Every tour, of any kind, goes to whoever has had the fewest tours so far.

  const tourTemplateIds = new Set(templates.filter(isTourTemplate).map((template) => template.id));
  const isTourMeta = (meta: TemplateMeta) => tourTemplateIds.has(meta.id);
  const tourLoad = (emp: RosterEmployee) =>
    board.column(colOf(emp)).filter((task) => tourTemplateIds.has(task.type)).length;

  const compareByAdjacencyThenLoad = (meta: TemplateMeta, range: RowRange) => (a: RosterEmployee, b: RosterEmployee) => {
    if (isTourMeta(meta)) {
      const tourDiff = tourLoad(a) - tourLoad(b);
      if (tourDiff !== 0) return tourDiff;
      return compareRotation(a, b);
    }
    const adjacencyDiff =
      getProtectedAdjacencyScore(colOf(a), range) - getProtectedAdjacencyScore(colOf(b), range);
    if (adjacencyDiff !== 0) return adjacencyDiff;
    const countDiff = board.getEmpCount(meta.id, a.id) - board.getEmpCount(meta.id, b.id);
    if (countDiff !== 0) return countDiff;
    return compareRotation(a, b);
  };

  // ---- Placement ----

  const placeTask = (
    meta: TemplateMeta,
    col: number,
    startRow: number,
    span: number,
    empId: EmployeeId,
    overrides?: { label?: string; type?: string; color?: string; waitingMinutes?: number }
  ) => {
    const label = overrides?.label || meta.template.name || "Task";
    const type = overrides?.type || meta.template.id || label;
    const placed = board.add(
      {
        type,
        label,
        col,
        startRow,
        span,
        color: overrides?.color || meta.template.color || colorForType(type),
        waitingMinutes: overrides?.waitingMinutes ?? meta.waitingMinutes,
        packingMinutes: meta.packingMinutes,
        employeeId: empId,
      },
      { templateId: meta.id, empId }
    );

    const paired = getPairedRanges(meta, { startRow, span })
      .filter(({ range }) => range.startRow >= MIN_ROW && range.startRow + range.span <= maxRowEx)
      .filter(({ range }) => board.isRangeFree(col, range))
      .map(({ meta: pairedMeta, range }) => ({
        meta: pairedMeta,
        task: placeTask(pairedMeta, col, range.startRow, range.span, empId),
      }));
    if (paired.length) pairedTasksByAnchor.set(placed.id, paired);
    return placed;
  };

  /** Takes a block back off the board, with any tasks placed alongside it. */
  const removeTask = (meta: TemplateMeta, task: GridTask, empId: EmployeeId) => {
    for (const paired of pairedTasksByAnchor.get(task.id) ?? []) removeTask(paired.meta, paired.task, empId);
    pairedTasksByAnchor.delete(task.id);
    board.remove(task, { templateId: meta.id, empId });
  };

  // ---- Handing over waiting time ----
  // A task whose waiting lead-in can be covered may start late when nobody is free
  // for the whole block: the all-staff task (like the briefing), or the only person
  // on a must-be-manned task (like Front Desk), keeps those rows instead.

  /** The row is taken by an all-staff task, or by the only person covering a must-be-manned task. */
  const canKeepWaitingRow = (col: number, row: number) =>
    board.column(col).some((task) => {
      if (row < task.startRow || row >= task.startRow + task.span) return false;
      const template = templateById.get(task.type);
      if (!template) return false;
      if (template.attendedByAll) return true;
      return (
        !!template.mustManned &&
        !isTourTemplate(template) &&
        board.peakConcurrency(task.type, { startRow: row, span: 1 }) === 1
      );
    });

  /** The block trimmed so its waiting lead-in starts after the rows other work keeps, or null. */
  const findWaitingHandOver = (meta: TemplateMeta, emp: RosterEmployee, row: number, span: number) => {
    const col = colOf(emp);
    for (let kept = 1; kept <= meta.coverableWaitingRows && kept < span; kept += 1) {
      if (!canKeepWaitingRow(col, row + kept - 1)) break;
      const range = { startRow: row + kept, span: span - kept };
      if (isFree(emp, range, meta)) {
        return { ...range, waitingMinutes: (meta.coverableWaitingRows - kept) * SLOT_MINUTES };
      }
    }
    return null;
  };

  /** Places the block for the first employee who can take it with part of the waiting time handed over. */
  const placeWithWaitingHandOver = (
    meta: TemplateMeta,
    candidates: RosterEmployee[],
    row: number,
    span: number,
    overrides?: { label?: string; type?: string; color?: string }
  ) => {
    for (const emp of candidates) {
      const handOver = findWaitingHandOver(meta, emp, row, span);
      if (!handOver) continue;
      placeTask(meta, colOf(emp), handOver.startRow, handOver.span, emp.id, {
        ...overrides,
        waitingMinutes: handOver.waitingMinutes,
      });
      return true;
    }
    return false;
  };

  /** A block of the task was placed for this set time, even if its waiting time was handed over. */
  const hasBlockForTime = (meta: TemplateMeta, row: number) =>
    board.generated.some(
      (task) => task.type === meta.id && task.startRow >= row && task.startRow <= row + meta.coverableWaitingRows
    );

  /**
   * When nobody can cover a must-be-manned row, someone whose tour is still in its
   * waiting lead-in there stays on cover instead and their tour starts later.
   */
  const coverFromTourWaiting = (meta: TemplateMeta, row: number) => {
    for (const emp of [...employees].sort(compareRotation)) {
      if (!isWithinShift(emp, { startRow: row, span: 1 })) continue;
      if (board.getEmpCount(meta.id, emp.id) >= meta.maxPerEmp) continue;
      const col = colOf(emp);
      const tour = board.column(col).find((task) => {
        const template = templateById.get(task.type);
        if (!template?.waitingCanBeCovered) return false;
        const { waitingRows } = getTaskSegmentRows(task);
        return row >= task.startRow && row < task.startRow + waitingRows;
      });
      if (!tour) continue;
      const cover = { startRow: tour.startRow, span: row + 1 - tour.startRow };
      if (board.exceedsConcurrentLimit(meta.id, cover, meta.maxConcurrentPerTimeslot)) continue;

      const countAs = { templateId: tour.type, empId: tour.employeeId ?? emp.id };
      const { id: _id, ...rest } = tour;
      board.remove(tour, countAs);
      board.add(
        {
          ...rest,
          startRow: row + 1,
          span: tour.span - cover.span,
          waitingMinutes: Math.max(0, (tour.waitingMinutes ?? 0) - cover.span * SLOT_MINUTES),
        },
        countAs
      );
      placeTask(meta, col, cover.startRow, cover.span, emp.id);
      return true;
    }
    return false;
  };

  const getRowVariantRank = (rows: number[], row: number) => {
    const index = rows.indexOf(row);
    return getRotatedRank(index < 0 ? 0 : index, rows.length, variant);
  };

  /** How many placements each future minimum template would still have for the employee. */
  const getFutureMinimumAvailabilityCounts = (
    emp: RosterEmployee,
    blockedRange: RowRange | null,
    futureMinimumMetas: TemplateMeta[]
  ) => {
    if (!futureMinimumMetas.length) return [];
    const employeeWindow = getEmployeeWindow(emp);
    if (!employeeWindow) return futureMinimumMetas.map(() => 0);
    const occupiedRanges = board.column(colOf(emp)).map((task) => ({ startRow: task.startRow, span: task.span }));

    return futureMinimumMetas.map((futureMeta) => {
      if (board.getEmpCount(futureMeta.id, emp.id) >= futureMeta.minPerEmp) return Number.POSITIVE_INFINITY;
      if (!futureMeta.window) return 0;
      const overlapWindow = {
        startRow: Math.max(employeeWindow.startRow, futureMeta.window.startRow),
        endRow: Math.min(employeeWindow.endRow, futureMeta.window.endRow),
      };
      if (overlapWindow.endRow <= overlapWindow.startRow) return 0;
      return getFeasiblePlacementRows({
        candidateRows: getCandidateRowsForMeta(futureMeta),
        span: futureMeta.span,
        employeeWindow: overlapWindow,
        occupiedRanges,
        blockedRange,
      }).length;
    });
  };

  /** How well the other employees could still cover must-be-manned work if this range is taken. */
  const getCoverageAvailabilityStats = (
    emp: RosterEmployee,
    blockedRange: RowRange,
    coverageMetas: TemplateMeta[]
  ): CoverageAvailability => {
    const stats = { blockedRows: 0, tightestCoverage: Number.POSITIVE_INFINITY, totalOptions: 0 };
    for (const coverageMeta of coverageMetas) {
      if (!coverageMeta.window) continue;
      const overlapStart = Math.max(blockedRange.startRow, coverageMeta.window.startRow);
      const overlapEnd = Math.min(blockedRange.startRow + blockedRange.span, coverageMeta.window.endRow);
      for (let row = overlapStart; row < overlapEnd; row += 1) {
        const requiredSpan = spanAt(coverageMeta, row, coverageMeta.window.endRow);
        if (!requiredSpan) continue;
        const availableEmployees = employees.filter(
          (other) => other.id !== emp.id && canTakePlacement(coverageMeta, other, { startRow: row, span: requiredSpan })
        ).length;
        stats.blockedRows += availableEmployees === 0 ? 1 : 0;
        stats.tightestCoverage = Math.min(stats.tightestCoverage, availableEmployees);
        stats.totalOptions += availableEmployees;
      }
    }
    return stats;
  };

  /** Distance from the middle of the rows both the employee and the template allow. */
  const getPlacementCenterDistance = (meta: TemplateMeta, emp: RosterEmployee, row: number, span: number) => {
    const employeeWindow = getEmployeeWindow(emp);
    const windowStart = Math.max(employeeWindow?.startRow ?? MIN_ROW, meta.window?.startRow ?? MIN_ROW);
    const windowEnd = Math.min(employeeWindow?.endRow ?? maxRowEx, meta.window?.endRow ?? maxRowEx);
    const latestStart = Math.max(windowStart, windowEnd - span);
    const center = windowStart <= latestStart ? (windowStart + latestStart) / 2 : windowStart;
    return Math.abs(row - center);
  };

  /** Penalises leaving single-slot gaps that nothing useful could fill. */
  const getPlacementGapPenalty = (emp: RosterEmployee, col: number, range: RowRange) => {
    const employeeWindow = getEmployeeWindow(emp);
    if (!employeeWindow) return Number.POSITIVE_INFINITY;
    const { prev, next } = board.neighbours(col, range);
    const prevEnd = prev ? prev.startRow + prev.span : employeeWindow.startRow;
    const nextStart = next ? next.startRow : employeeWindow.endRow;
    let penalty = 0;
    if (range.startRow - prevEnd === 1) penalty += 6;
    if (nextStart - (range.startRow + range.span) === 1) penalty += 6;
    return penalty;
  };

  /** Prefers extending runs of the same task over switching between tasks. */
  const getPlacementTransitionPenalty = (meta: TemplateMeta, col: number, range: RowRange) => {
    const { prev, next } = board.neighbours(col, range);
    let penalty = 0;
    if (prev?.type === meta.id) penalty -= 1;
    else if (prev) penalty += 0.5;
    if (next?.type === meta.id) penalty -= 1;
    else if (next) penalty += 0.5;
    if (prev && next && prev.type === next.type && prev.type !== meta.id) penalty += 1;
    return penalty;
  };

  const buildPlacementCandidate = (
    meta: TemplateMeta,
    emp: RosterEmployee,
    row: number,
    span: number,
    candidateRows: number[],
    options: PlacementOptions & { ignoreEmpLimit?: boolean } = {}
  ): PlacementCandidate | null => {
    const col = colOf(emp);
    const range = { startRow: row, span };
    if (!options.ignoreEmpLimit && board.getEmpCount(meta.id, emp.id) >= meta.maxPerEmp) return null;
    if (meta.protectsTourWindow && getProtectedTaskConflict(col, getProtectedRangeForMeta(meta, row, span))) return null;
    if (!isFree(emp, range, meta)) return null;
    if (board.exceedsConcurrentLimit(meta.id, range, options.concurrentLimit ?? meta.maxConcurrentPerTimeslot)) return null;
    if (!options.ignoreConsecutiveLimit && exceedsConsecutiveLimit(meta, col, range)) return null;

    return {
      meta,
      emp,
      row,
      span,
      col,
      futureAvailability: getFutureMinimumAvailabilityCounts(emp, range, options.futureMinimumMetas ?? []),
      coverageAvailability: getCoverageAvailabilityStats(emp, range, options.coverageMetas ?? []),
      activeCount: board.peakConcurrency(meta.id, range),
      empCount: board.getEmpCount(meta.id, emp.id),
      totalCount: board.getTotal(meta.id),
      centerDistance: getPlacementCenterDistance(meta, emp, row, span),
      transitionPenalty: getPlacementTransitionPenalty(meta, col, range),
      gapPenalty: getPlacementGapPenalty(emp, col, range),
      rowRank: getRowVariantRank(candidateRows, row),
    };
  };

  const comparePlacementCandidates = (a: PlacementCandidate, b: PlacementCandidate) => {
    if (isTourMeta(a.meta)) {
      const tourDiff = tourLoad(a.emp) - tourLoad(b.emp);
      if (tourDiff !== 0) return tourDiff;
    }
    const coverageDiff = compareCoverageAvailability(a.coverageAvailability, b.coverageAvailability);
    if (coverageDiff !== 0) return coverageDiff;
    const futureDiff = compareFutureMinimumAvailability(a.futureAvailability, b.futureAvailability);
    if (futureDiff !== 0) return futureDiff;
    if (a.gapPenalty !== b.gapPenalty) return a.gapPenalty - b.gapPenalty;
    if (a.transitionPenalty !== b.transitionPenalty) return a.transitionPenalty - b.transitionPenalty;
    if (a.activeCount !== b.activeCount) return a.activeCount - b.activeCount;
    if (a.empCount !== b.empCount) return a.empCount - b.empCount;
    if (a.totalCount !== b.totalCount) return a.totalCount - b.totalCount;
    if (a.centerDistance !== b.centerDistance) return a.centerDistance - b.centerDistance;
    if (a.rowRank !== b.rowRank) return a.rowRank - b.rowRank;
    return compareRotation(a.emp, b.emp);
  };

  const pickPlacementForRow = (
    meta: TemplateMeta,
    row: number,
    span: number,
    candidateRows: number[],
    options: PlacementOptions
  ) =>
    employees
      .map((emp) => buildPlacementCandidate(meta, emp, row, span, candidateRows, options))
      .filter((candidate): candidate is PlacementCandidate => !!candidate)
      .sort(comparePlacementCandidates)[0] ?? null;

  const collectPlacementCandidatesForMeta = (
    meta: TemplateMeta,
    candidateRows: number[],
    options: PlacementOptions & { singlePerRow?: boolean }
  ) => {
    const candidates: PlacementCandidate[] = [];
    for (const row of candidateRows) {
      const span = spanAt(meta, row);
      if (!span) continue;
      if (options.singlePerRow && board.hasTaskStartingAt(meta.id, row)) continue;
      for (const emp of employees) {
        const candidate = buildPlacementCandidate(meta, emp, row, span, candidateRows, options);
        if (candidate) candidates.push(candidate);
      }
    }
    return candidates.sort(comparePlacementCandidates);
  };

  // ---- Template selection ----

  const templatesToSchedule = templates
    .filter((template) => template.enabled !== false && !isPairedTemplate(template))
    .filter((template) => templateAppliesOnDay(template, dayKey))
    .map((template) => buildTemplateMeta(template, dayKey, timeline))
    .filter((meta): meta is TemplateMeta => !!meta)
    .sort((a, b) => getAutofillTemplatePriority(b) - getAutofillTemplatePriority(a));
  const finalPassTemplates = templatesToSchedule.filter(
    (meta) => !meta.fixedTimeBlock && (meta.attendedByAll || meta.overwriteExistingTasks)
  );
  const templatesForPrimaryPass = templatesToSchedule.filter(
    (meta) => !meta.attendedByAll && !meta.overwriteExistingTasks
  );

  const schoolTourTemplate = templates.find((template) => template.schoolTourImportTarget) || null;
  const schoolTourMeta = schoolTourTemplate ? buildTemplateMeta(schoolTourTemplate, dayKey, timeline) : null;

  if (!templatesToSchedule.length) return { tasks: [] };

  const unmetMinimums: string[] = [];
  const protectedTaskFailures: string[] = [];
  const importedSchoolTourFailures: string[] = [];

  // ---- Pass 1: imported school tours at their booked times ----

  const placeSchoolTour = (meta: TemplateMeta, schoolTour: SchoolTourEntry, index: number) => {
    // Blocks are numbered by start time; the school names are listed under the roster.
    const tourLabel = schoolTourLabel(index);
    const failed = () => importedSchoolTourFailures.push(`${tourLabel} (${schoolTour.schoolName})`);
    const mainStartRow = rowFromTime(schoolTour.startTime, "floor");
    if (mainStartRow === null) return failed();
    const startRow = mainStartRow - Math.max(0, Math.round((meta.waitingMinutes || 0) / 15));
    const span = meta.span;
    if (!span || startRow < MIN_ROW || startRow + span > maxRowEx) return failed();
    const range = { startRow, span };
    const protectedRange = getProtectedRangeForMeta(meta, startRow, span);

    const picked = employees
      .filter((emp) => {
        const hasProtectedConflict = meta.protectsTourWindow && !!getProtectedTaskConflict(colOf(emp), protectedRange);
        return !hasProtectedConflict && canTakePlacement(meta, emp, range);
      })
      .sort(compareByAdjacencyThenLoad(meta, range))[0];
    const overrides = { label: tourLabel, type: meta.id, color: meta.template.color || colorForType(meta.id) };
    if (!picked) {
      const candidates = employees
        .filter((emp) => board.getEmpCount(meta.id, emp.id) < meta.maxPerEmp)
        .sort(compareByAdjacencyThenLoad(meta, range));
      if (!placeWithWaitingHandOver(meta, candidates, startRow, span, overrides)) failed();
      return;
    }

    placeTask(meta, colOf(picked), startRow, span, picked.id, overrides);
  };

  const placeImportedSchoolTours = () => {
    if (!schoolTourMeta) {
      if (schoolTours.length) importedSchoolTourFailures.push("no task is marked as the imported school tours target");
      return;
    }
    sortSchoolTours([...schoolTours]).forEach((schoolTour, index) => placeSchoolTour(schoolTourMeta, schoolTour, index));
  };

  // ---- Pass 2: fixed-time blocks ----

  const getFixedBlockCandidateRows = (meta: TemplateMeta) => {
    if (meta.regularTimeRows.length > 0) return meta.regularTimeRows;
    if (!meta.window) return [];
    if (meta.mustManned) return rowsBetween(meta.window.startRow, meta.window.endRow);
    return getCandidateRowsForMeta(meta);
  };

  const reserveFixedTimeBlocks = () => {
    for (const meta of templatesToSchedule.filter((entry) => entry.fixedTimeBlock)) {
      const candidateRows = getFixedBlockCandidateRows(meta);
      const desiredPlacements = Math.min(
        meta.hasFixedTimes || meta.mustManned ? candidateRows.length : 1,
        meta.limitPerDay
      );
      let placementsMade = 0;

      for (const row of candidateRows) {
        if (placementsMade >= desiredPlacements) break;
        if (board.getTotal(meta.id) >= meta.limitPerDay) break;
        const span = spanAt(meta, row);
        if (!span) continue;
        const range = { startRow: row, span };

        const sortedEmployees = employees
          .filter((emp) => isWithinShift(emp, range))
          .filter(
            (emp) =>
              board.getEmpCount(meta.id, emp.id) < meta.maxPerEmp && !exceedsConsecutiveLimit(meta, colOf(emp), range)
          )
          .sort(compareByAdjacencyThenLoad(meta, range));

        if (meta.attendedByAll) {
          const attendees = sortedEmployees.filter(
            (emp) => isFree(emp, range, meta) && !exceedsConsecutiveLimit(meta, colOf(emp), range)
          );
          if (!attendees.length) {
            protectedTaskFailures.push(`${meta.template.name} ${timeRangeForSpan(row, span)}`);
            continue;
          }
          attendees.forEach((emp) => placeTask(meta, colOf(emp), row, span, emp.id));
          placementsMade += 1;
          continue;
        }

        const picked = sortedEmployees.find((emp) => isFree(emp, range, meta));
        if (!picked && placeWithWaitingHandOver(meta, sortedEmployees, row, span)) {
          placementsMade += 1;
          continue;
        }
        if (!picked) {
          protectedTaskFailures.push(`${meta.template.name} ${timeRangeForSpan(row, span)}`);
          continue;
        }
        placeTask(meta, colOf(picked), row, span, picked.id);
        placementsMade += 1;
      }
    }
  };

  // ---- Pass 3: minimums, cover and other scheduled tasks ----

  /** Whether the employee's shift overlaps the template's window by enough to fit one block. */
  const shiftCanFit = (meta: TemplateMeta, emp: RosterEmployee) => {
    const window = getEmployeeWindow(emp);
    if (!window) return false;
    const overlap =
      Math.min(window.endRow, meta.window?.endRow ?? window.endRow) - Math.max(window.startRow, meta.window?.startRow ?? window.startRow);
    return overlap >= (meta.allowShrink ? meta.minSpan : meta.span);
  };

  /**
   * Gives every employee their minimum number of this task, backtracking when an
   * early choice would leave someone without a slot.
   */
  const assignMinimumsForMeta = (
    meta: TemplateMeta,
    candidateRows: number[],
    futureMinimumMetas: TemplateMeta[],
    coverageMetas: TemplateMeta[]
  ) => {
    // Someone whose shift doesn't reach the task's window (e.g. finishing before the
    // afternoon break) can't have one, and mustn't stop everyone else getting theirs.
    const pendingEmployees = employees
      .filter((emp) => shiftCanFit(meta, emp))
      .flatMap((emp) => Array.from({ length: Math.max(0, meta.minPerEmp - board.getEmpCount(meta.id, emp.id)) }, () => emp));

    const getCandidateRowsForEmployee = (emp: RosterEmployee, concurrentLimit: number) => {
      const window = getEmployeeWindow(emp);
      if (!window) return [];
      const col = colOf(emp);
      const overlapStart = Math.max(window.startRow, meta.window?.startRow ?? window.startRow);
      const overlapEnd = Math.min(window.endRow, meta.window?.endRow ?? window.endRow);
      const latestStart = Math.max(overlapStart, overlapEnd - meta.span);
      const idealRow = overlapStart <= latestStart ? (overlapStart + latestStart) / 2 : overlapStart;
      const peakAt = (row: number) => {
        const span = spanAt(meta, row);
        return span ? board.peakConcurrency(meta.id, { startRow: row, span }) : Number.POSITIVE_INFINITY;
      };

      return candidateRows
        .filter((row) => {
          const span = spanAt(meta, row);
          if (!span) return false;
          const range = { startRow: row, span };
          return (
            isFree(emp, range, meta) &&
            !board.exceedsConcurrentLimit(meta.id, range, concurrentLimit) &&
            !exceedsConsecutiveLimit(meta, col, range)
          );
        })
        .sort((a, b) => {
          const peakA = peakAt(a);
          const peakB = peakAt(b);
          if (peakA !== peakB) return peakA - peakB;
          const variantDiff = getRowVariantRank(candidateRows, a) - getRowVariantRank(candidateRows, b);
          if (variantDiff !== 0) return variantDiff;
          const distanceDiff = Math.abs(a - idealRow) - Math.abs(b - idealRow);
          if (distanceDiff !== 0) return distanceDiff;
          return a - b;
        });
    };

    const backtrack = (remaining: RosterEmployee[], concurrentLimit: number): boolean => {
      if (!remaining.length) return true;

      // Place the most constrained employee first.
      let bestIndex = -1;
      let bestRows: number[] | null = null;
      for (let index = 0; index < remaining.length; index += 1) {
        const rows = getCandidateRowsForEmployee(remaining[index], concurrentLimit);
        if (rows.length === 0) return false;
        if (bestRows === null || rows.length < bestRows.length) {
          bestRows = rows;
          bestIndex = index;
        }
      }
      if (bestIndex < 0 || !bestRows) return false;

      const emp = remaining[bestIndex];
      const col = colOf(emp);
      const nextRemaining = remaining.slice(0, bestIndex).concat(remaining.slice(bestIndex + 1));
      const rankedRows = bestRows
        .map((row) => {
          const span = spanAt(meta, row);
          if (!span) return null;
          const blockedRange = { startRow: row, span };
          return {
            row,
            span,
            futureAvailability: getFutureMinimumAvailabilityCounts(emp, blockedRange, futureMinimumMetas),
            coverageAvailability: getCoverageAvailabilityStats(emp, blockedRange, coverageMetas),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => !!entry)
        .sort((a, b) => {
          const coverageDiff = compareCoverageAvailability(a.coverageAvailability, b.coverageAvailability);
          if (coverageDiff !== 0) return coverageDiff;
          const futureDiff = compareFutureMinimumAvailability(a.futureAvailability, b.futureAvailability);
          if (futureDiff !== 0) return futureDiff;
          const variantDiff = getRowVariantRank(candidateRows, a.row) - getRowVariantRank(candidateRows, b.row);
          if (variantDiff !== 0) return variantDiff;
          return a.row - b.row;
        });

      for (const { row, span } of rankedRows) {
        const task = placeTask(meta, col, row, span, emp.id);
        if (backtrack(nextRemaining, concurrentLimit)) return true;
        removeTask(meta, task, emp.id);
      }
      return false;
    };

    // Optional tasks first try to avoid doubling up, then accept the template's real limit.
    const preferredConcurrentLimit = getPreferredConcurrentLimit(meta.maxConcurrentPerTimeslot, {
      preferSolo: !meta.mustManned,
    });
    if (backtrack(pendingEmployees, preferredConcurrentLimit)) return true;
    if (preferredConcurrentLimit !== meta.maxConcurrentPerTimeslot && backtrack(pendingEmployees, meta.maxConcurrentPerTimeslot)) {
      return true;
    }

    // No arrangement suits everyone, so give as many people as possible their slot,
    // most constrained first, rather than nobody.
    const remaining = [...pendingEmployees];
    while (remaining.length) {
      const options = remaining.map((emp) => ({ emp, rows: getCandidateRowsForEmployee(emp, meta.maxConcurrentPerTimeslot) }));
      options.sort((a, b) => (a.rows.length || Infinity) - (b.rows.length || Infinity));
      const next = options.find((option) => option.rows.length > 0);
      if (!next) break;
      const span = spanAt(meta, next.rows[0]);
      placeTask(meta, colOf(next.emp), next.rows[0], span, next.emp.id);
      remaining.splice(remaining.indexOf(next.emp), 1);
    }
    return remaining.length === 0;
  };

  /** Covers every row of a must-be-manned template's window, one employee at a time. */
  const scheduleCoverage = (meta: TemplateMeta, window: RowWindow, futureMinimumMetas: TemplateMeta[]) => {
    const requiredRows = meta.hasFixedTimes ? meta.regularTimeRows : rowsBetween(window.startRow, window.endRow);
    const feasibleEmployeeCount = (row: number) => {
      const span = spanAt(meta, row, window.endRow);
      if (!span) return Number.POSITIVE_INFINITY;
      return employees.filter((emp) => canTakePlacement(meta, emp, { startRow: row, span })).length;
    };
    // With a daily limit that can't cover every row, spend placements on the hardest rows first.
    const orderedRequiredRows =
      meta.regularTimeRows.length === 0 && Number.isFinite(meta.limitPerDay) && meta.limitPerDay < requiredRows.length
        ? [...requiredRows].sort((a, b) => {
            const feasibleA = feasibleEmployeeCount(a);
            const feasibleB = feasibleEmployeeCount(b);
            return feasibleA !== feasibleB ? feasibleA - feasibleB : b - a;
          })
        : requiredRows;

    for (const row of orderedRequiredRows) {
      if (board.getTotal(meta.id) >= meta.limitPerDay) break;
      const requiredSpan = spanAt(meta, row, window.endRow);
      if (!requiredSpan) continue;
      const alreadyCovered =
        meta.regularTimeRows.length > 0 ? hasBlockForTime(meta, row) : board.isTypeCoveredAt(meta.id, row);
      if (alreadyCovered) continue;
      // If nobody is free for a full block (a briefing may be in the way), cover with a shorter one.
      const spans = meta.allowShrink
        ? rowsBetween(meta.minSpan, requiredSpan + 1).reverse()
        : [requiredSpan];
      // Rotate people off after a stint; only keep someone on longer if nobody else can cover.
      let placed = false;
      for (const ignoreConsecutiveLimit of [false, true]) {
        for (const span of spans) {
          const picked = pickPlacementForRow(meta, row, span, orderedRequiredRows, {
            futureMinimumMetas,
            ignoreConsecutiveLimit,
          });
          if (!picked) continue;
          placeTask(meta, picked.col, row, span, picked.emp.id);
          placed = true;
          break;
        }
        if (placed) break;
      }
      if (!placed && meta.regularTimeRows.length === 0 && meta.allowShrink) coverFromTourWaiting(meta, row);
    }
  };

  const schedulePrimaryMeta = (
    meta: TemplateMeta,
    futureMinimumMetas: TemplateMeta[] = [],
    coverageMetas: TemplateMeta[] = []
  ) => {
    const window = meta.window;
    if (!window) return;

    // Cover comes first; any spare time on the task is shared out with the floor tasks later.
    if (meta.mustManned) {
      scheduleCoverage(meta, window, futureMinimumMetas);
      return;
    }
    if (isAutofillFillerTemplate(meta)) return;

    const candidateRows =
      meta.regularTimeRows.length > 0
        ? meta.regularTimeRows
        : rowsBetween(window.startRow, window.endRow).filter((row) => !!spanAt(meta, row, window.endRow));
    if (candidateRows.length === 0) return;

    if (meta.minPerEmp > 0 && !assignMinimumsForMeta(meta, candidateRows, futureMinimumMetas, coverageMetas)) {
      const unmetEmployees = employees
        .filter((emp) => shiftCanFit(meta, emp) && board.getEmpCount(meta.id, emp.id) < meta.minPerEmp)
        .map((emp) => emp.name);
      if (unmetEmployees.length) unmetMinimums.push(`${meta.template.name}: ${unmetEmployees.join(", ")}`);
      return;
    }

    const desiredCount = getDesiredPlacements(meta, candidateRows);
    while (board.getTotal(meta.id) < desiredCount && board.getTotal(meta.id) < meta.limitPerDay) {
      const picked = collectPlacementCandidatesForMeta(meta, candidateRows, {
        futureMinimumMetas,
        coverageMetas,
        singlePerRow: meta.hasFixedTimes,
      })[0];
      if (!picked) break;
      placeTask(meta, picked.col, picked.row, picked.span, picked.emp.id);
    }
  };

  // ---- Pass 4: all-hands and overriding tasks ----

  /** Places a task that may clear other work out of its way, unless that work is protected. */
  const placeFinalTask = (meta: TemplateMeta, emp: RosterEmployee, row: number, span: number) => {
    const col = colOf(emp);
    const range = { startRow: row, span };
    const blockedRange = getProtectedRangeForMeta(meta, row, span);
    if (exceedsConsecutiveLimit(meta, col, range)) return false;
    if (meta.overwriteExistingTasks) {
      if (hasProtectedMinimumConflict(col, blockedRange)) return false;
      if (meta.protectsTourWindow && getProtectedTaskConflict(col, blockedRange)) return false;
      if (!meta.protectsTourWindow && board.column(col).some((task) => {
        const protectedRange = getProtectedRangeForTask(task);
        return !!protectedRange && rangesOverlap(blockedRange, protectedRange);
      })) {
        return false;
      }
      const supportBlocked =
        meta.protectsTourWindow &&
        getSupportRangesForProtectedMeta(meta, row, span).some((supportRange) => !board.isRangeFree(col, supportRange));
      if (supportBlocked) return false;
      board.clipColumnAround(col, blockedRange);
    } else if (!isFree(emp, range, meta)) {
      return false;
    }
    placeTask(meta, col, row, span, emp.id);
    return true;
  };

  const scheduleAttendedByAllMeta = (meta: TemplateMeta) => {
    const candidateRows = getCandidateRowsForMeta(meta);
    const desiredPlacements = getDesiredPlacements(meta, candidateRows);
    let placementsMade = 0;

    for (const row of candidateRows) {
      if (placementsMade >= desiredPlacements) break;
      const span = spanAt(meta, row);
      if (!span) continue;
      const attendees = getEligibleEmployeesForRow(row, span);
      if (!attendees.length) continue;
      if (!meta.overwriteExistingTasks && attendees.some((emp) => !isFree(emp, { startRow: row, span }, meta))) continue;
      attendees.forEach((emp) => placeFinalTask(meta, emp, row, span));
      placementsMade += 1;
    }
  };

  const scheduleOverrideMeta = (meta: TemplateMeta) => {
    const candidateRows = getCandidateRowsForMeta(meta);
    const desiredPlacements = getDesiredPlacements(meta, candidateRows);

    for (const row of candidateRows) {
      if (board.getTotal(meta.id) >= desiredPlacements) break;
      if (board.getTotal(meta.id) >= meta.limitPerDay) break;
      const span = spanAt(meta, row);
      if (!span) continue;
      const range = { startRow: row, span };

      const sortedEmployees = getEligibleEmployeesForRow(row, span)
        .filter((emp) => board.getEmpCount(meta.id, emp.id) < meta.maxPerEmp)
        .sort((a, b) => {
          if (isTourMeta(meta)) {
            const tourDiff = tourLoad(a) - tourLoad(b);
            if (tourDiff !== 0) return tourDiff;
          }
          const conflictDiff = board.conflictCount(colOf(a), range) - board.conflictCount(colOf(b), range);
          if (conflictDiff !== 0) return conflictDiff;
          const countDiff = board.getEmpCount(meta.id, a.id) - board.getEmpCount(meta.id, b.id);
          if (countDiff !== 0) return countDiff;
          return compareRotation(a, b);
        });

      let placed = false;
      for (const emp of sortedEmployees) {
        if (!meta.overwriteExistingTasks && !isFree(emp, range, meta)) continue;
        if (placeFinalTask(meta, emp, row, span)) {
          placed = true;
          break;
        }
      }
      if (!placed) placeWithWaitingHandOver(meta, sortedEmployees, row, span);

      if (meta.protectsTourWindow && !hasBlockForTime(meta, row)) {
        protectedTaskFailures.push(`${meta.template.name} ${timeRangeForSpan(row, span)}`);
      }
    }
  };

  // ---- Pass 5: spread spare time across floor tasks ----
  // Works through the day slot by slot for everyone at once, so floor tasks are
  // shared out instead of the first person in each column taking the best one.

  const fillTemplates = templatesForPrimaryPass.filter(isAutofillFillerTemplate);
  const floorRowsByEmp = new Map<EmployeeId, number>();
  /** Time on capped floor tasks, which are scarce and so shared out in turn. */
  const cappedRowsByEmp = new Map<EmployeeId, number>();
  const floorRowsByEmpTask = new Map<string, number>();
  const floorKey = (empId: EmployeeId, metaId: string) => `${empId}\u0000${metaId}`;

  const floorOptionsFor = (
    emp: RosterEmployee,
    row: number,
    freeUntil: number,
    ignoreEmpLimit: boolean,
    ignoreConsecutiveLimit = false
  ) => {
    const col = colOf(emp);
    return fillTemplates.flatMap((meta) => {
      if (board.getTotal(meta.id) >= meta.limitPerDay) return [];
      const rangeEnd = windowEndAt(meta, row);
      if (rangeEnd === null) return [];
      if (!ignoreEmpLimit && board.getEmpCount(meta.id, emp.id) >= meta.maxPerEmp) return [];
      const span = resolveAutofillPlacementSpan({
        baseSpan: meta.allowShrink ? meta.maxConsecutiveSpan : meta.span,
        availableSpan: Math.min(freeUntil - pairedRowsAfter(meta), rangeEnd) - row,
        allowShrink: meta.allowShrink,
        minSpan: meta.minSpan,
        maxConsecutiveSpan: meta.maxConsecutiveSpan,
      });
      if (!span) return [];
      const range = { startRow: row, span };
      if (board.exceedsConcurrentLimit(meta.id, range, meta.maxConcurrentPerTimeslot)) return [];
      if (!ignoreConsecutiveLimit && exceedsConsecutiveLimit(meta, col, range)) return [];
      if (!getPairedRanges(meta, range).every((paired) => isFree(emp, paired.range))) return [];
      const capped = Number.isFinite(meta.maxConcurrentPerTimeslot);
      return [
        {
          meta,
          span,
          capped,
          load: capped ? board.peakConcurrency(meta.id, range) / meta.maxConcurrentPerTimeslot : 0,
          headcount: board.peakConcurrency(meta.id, range),
          repeatsPrevious: board.neighbours(col, range).prev?.type === meta.id,
          doneAlready: floorRowsByEmpTask.get(floorKey(emp.id, meta.id)) ?? 0,
          order: getRotatedRank(fillTemplates.indexOf(meta), fillTemplates.length, variant),
        },
      ];
    });
  };

  type FloorOption = ReturnType<typeof floorOptionsFor>[number];
  const compareFloorOptions = (a: FloorOption, b: FloorOption) =>
    // Capped floor tasks with room come first; uncapped ones only soak up what's left.
    Number(a.capped === false) - Number(b.capped === false) ||
    a.load - b.load ||
    // Move people on after a stint rather than repeating the same task.
    Number(a.repeatsPrevious) - Number(b.repeatsPrevious) ||
    // Spread spare people across tasks rather than piling them onto one.
    a.headcount - b.headcount ||
    a.doneAlready - b.doneAlready ||
    a.order - b.order;

  const spreadFloorTime = () => {
    if (!fillTemplates.length) return;
    for (let row = MIN_ROW; row < maxRowEx; row += 1) {
      const waiting = employees
        .filter((emp) => isWithinShift(emp, { startRow: row, span: 1 }) && board.isRangeFree(colOf(emp), { startRow: row, span: 1 }))
        // Whoever has had the least time on the scarce (capped) tasks picks first.
        .sort(
          (a, b) =>
            (cappedRowsByEmp.get(a.id) ?? 0) - (cappedRowsByEmp.get(b.id) ?? 0) ||
            (floorRowsByEmp.get(a.id) ?? 0) - (floorRowsByEmp.get(b.id) ?? 0) ||
            compareRotation(a, b)
        );

      for (const emp of waiting) {
        const window = getEmployeeWindow(emp)!;
        const freeUntil = board.freeSegments(colOf(emp), row, window.endRow)[0]?.endRow ?? row;
        if (freeUntil <= row) continue;
        // Respect per-person limits and stint lengths when possible; otherwise fill anyway rather than leave a hole.
        let options = floorOptionsFor(emp, row, freeUntil, false);
        if (!options.length) options = floorOptionsFor(emp, row, freeUntil, true);
        if (!options.length) options = floorOptionsFor(emp, row, freeUntil, true, true);
        const picked = options.sort(compareFloorOptions)[0];
        if (!picked) continue;
        placeTask(picked.meta, colOf(emp), row, picked.span, emp.id);
        floorRowsByEmp.set(emp.id, (floorRowsByEmp.get(emp.id) ?? 0) + picked.span);
        if (picked.capped) cappedRowsByEmp.set(emp.id, (cappedRowsByEmp.get(emp.id) ?? 0) + picked.span);
        const key = floorKey(emp.id, picked.meta.id);
        floorRowsByEmpTask.set(key, (floorRowsByEmpTask.get(key) ?? 0) + picked.span);
      }
    }
  };

  // ---- Run the passes ----

  placeImportedSchoolTours();
  reserveFixedTimeBlocks();

  const minimumTemplates = templatesForPrimaryPass.filter(isMinimumMeta);
  const coverageTemplates = templatesForPrimaryPass.filter((meta) => meta.mustManned);
  const otherPrimaryTemplates = templatesForPrimaryPass.filter(
    (meta) => !meta.mustManned && !isMinimumMeta(meta) && !isAutofillFillerTemplate(meta)
  );
  minimumTemplates.forEach((meta, index) =>
    schedulePrimaryMeta(meta, minimumTemplates.slice(index + 1), coverageTemplates)
  );
  coverageTemplates.forEach((meta) => schedulePrimaryMeta(meta));
  otherPrimaryTemplates.forEach((meta) => schedulePrimaryMeta(meta));

  finalPassTemplates.forEach((meta) =>
    meta.attendedByAll ? scheduleAttendedByAllMeta(meta) : scheduleOverrideMeta(meta)
  );

  spreadFloorTime();

  // ---- Report what couldn't be placed ----

  /** Everyone working is at an all-staff task (like the briefing), so nobody can be elsewhere. */
  const everyoneAtAllHands = (row: number) => {
    const onShift = employees.filter((emp) => isWithinShift(emp, { startRow: row, span: 1 }));
    return (
      onShift.length > 0 &&
      onShift.every((emp) =>
        board.column(colOf(emp)).some(
          (task) => row >= task.startRow && row < task.startRow + task.span && !!templateById.get(task.type)?.attendedByAll
        )
      )
    );
  };

  const unmetCoverage = templatesForPrimaryPass
    .filter((meta) => meta.mustManned && meta.window)
    .flatMap((meta) => {
      const window = meta.window!;
      if (meta.hasFixedTimes) {
        return meta.regularTimeRows
          .filter((row) => !hasBlockForTime(meta, row))
          .map((row) => `${meta.template.name} ${timeRangeForSpan(row, spanAt(meta, row, window.endRow) || 1)}`);
      }
      const gaps: string[] = [];
      let gapStart: number | null = null;
      for (let row = window.startRow; row < window.endRow; row += 1) {
        // Gaps between the task's time ranges don't need cover.
        const covered =
          windowEndAt(meta, row) === null || board.isTypeCoveredAt(meta.id, row) || everyoneAtAllHands(row);
        if (!covered && gapStart === null) {
          gapStart = row;
        } else if (covered && gapStart !== null) {
          gaps.push(`${meta.template.name} ${timeRangeForSpan(gapStart, row - gapStart)}`);
          gapStart = null;
        }
      }
      if (gapStart !== null) gaps.push(`${meta.template.name} ${timeRangeForSpan(gapStart, window.endRow - gapStart)}`);
      return gaps;
    });

  const messages: string[] = [];
  if (unmetMinimums.length) {
    messages.push(`Autofill could not place required tasks for: ${unmetMinimums.join(", ")}`);
  }
  if (unmetCoverage.length) {
    messages.push(`Autofill could not fully man: ${unmetCoverage.join(", ")}`);
  }
  if (protectedTaskFailures.length) {
    messages.push(`Autofill could not place protected tasks without overlap: ${protectedTaskFailures.join(", ")}`);
  }
  if (importedSchoolTourFailures.length) {
    messages.push(`Autofill could not place school tours: ${importedSchoolTourFailures.join(", ")}`);
  }

  return {
    tasks: mergeAdjacentTasks(board.generated, (task) => isMergeableTask(task, templateById.get(task.type))),
    notice: messages.length ? { title: "Autofill note", messages } : null,
  };
}
