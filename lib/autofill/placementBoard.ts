import { clipTaskAroundBlockedRange } from "@/lib/rosterAutofill";
import type { GridTask } from "@/lib/rosterTypes";

export type RowRange = { startRow: number; span: number };

type EmployeeId = string | number;

export function rangesOverlap(a: RowRange, b: RowRange) {
  return a.startRow < b.startRow + b.span && a.startRow + a.span > b.startRow;
}

function sortTasks(list: GridTask[]) {
  return list.sort((a, b) => a.col - b.col || a.startRow - b.startRow || String(a.id).localeCompare(String(b.id)));
}

/**
 * The tasks placed so far during one autofill run, indexed by column, plus
 * per-template counters used to enforce daily and per-employee limits.
 */
export class PlacementBoard {
  readonly generated: GridTask[] = [];
  private readonly tasksByCol = new Map<number, GridTask[]>();
  private readonly countsByTemplate = new Map<string, Map<EmployeeId, number>>();
  private readonly totalsByTemplate = new Map<string, number>();

  constructor(private readonly createId: () => string) {}

  column(col: number): GridTask[] {
    return this.tasksByCol.get(col) ?? [];
  }

  getTotal(templateId: string) {
    return this.totalsByTemplate.get(templateId) ?? 0;
  }

  getEmpCount(templateId: string, empId: EmployeeId) {
    return this.countsByTemplate.get(templateId)?.get(empId) ?? 0;
  }

  add(task: Omit<GridTask, "id">, countAs: { templateId: string; empId: EmployeeId }) {
    const placed: GridTask = { id: this.createId(), ...task };
    this.generated.push(placed);
    if (!this.tasksByCol.has(placed.col)) this.tasksByCol.set(placed.col, []);
    this.tasksByCol.get(placed.col)!.push(placed);
    sortTasks(this.tasksByCol.get(placed.col)!);
    sortTasks(this.generated);

    const { templateId, empId } = countAs;
    if (!this.countsByTemplate.has(templateId)) this.countsByTemplate.set(templateId, new Map());
    const counts = this.countsByTemplate.get(templateId)!;
    counts.set(empId, (counts.get(empId) ?? 0) + 1);
    this.totalsByTemplate.set(templateId, this.getTotal(templateId) + 1);
    return placed;
  }

  remove(task: GridTask, countAs: { templateId: string; empId: EmployeeId }) {
    const generatedIndex = this.generated.findIndex((entry) => entry.id === task.id);
    if (generatedIndex >= 0) this.generated.splice(generatedIndex, 1);
    const list = this.tasksByCol.get(task.col);
    if (list) {
      const colIndex = list.findIndex((entry) => entry.id === task.id);
      if (colIndex >= 0) list.splice(colIndex, 1);
    }

    const { templateId, empId } = countAs;
    const counts = this.countsByTemplate.get(templateId);
    if (counts) counts.set(empId, Math.max(0, (counts.get(empId) ?? 0) - 1));
    this.totalsByTemplate.set(templateId, Math.max(0, this.getTotal(templateId) - 1));
  }

  isRangeFree(col: number, range: RowRange) {
    return !this.column(col).some((task) => rangesOverlap(range, task));
  }

  /** Number of tasks in the column that overlap the range. */
  conflictCount(col: number, range: RowRange) {
    return this.column(col).filter((task) => rangesOverlap(range, task)).length;
  }

  isTypeCoveredAt(type: string, row: number) {
    return this.generated.some((task) => task.type === type && row >= task.startRow && row < task.startRow + task.span);
  }

  hasTaskStartingAt(type: string, row: number) {
    return this.generated.some((task) => task.type === type && task.startRow === row);
  }

  /** Largest number of simultaneous tasks of this type at any row of the range. */
  peakConcurrency(type: string, range: RowRange) {
    let peak = 0;
    for (let row = range.startRow; row < range.startRow + range.span; row += 1) {
      peak = Math.max(peak, this.activeAt(type, row));
    }
    return peak;
  }

  exceedsConcurrentLimit(type: string, range: RowRange, limit: number) {
    if (!Number.isFinite(limit)) return false;
    for (let row = range.startRow; row < range.startRow + range.span; row += 1) {
      if (this.activeAt(type, row) >= limit) return true;
    }
    return false;
  }

  private activeAt(type: string, row: number) {
    return this.generated.filter((task) => task.type === type && row < task.startRow + task.span && row + 1 > task.startRow)
      .length;
  }

  /** Length of the unbroken run of this type the range would join in the column. */
  consecutiveSpan(col: number, type: string, range: RowRange) {
    const list = this.column(col);
    let total = range.span;
    let cursorStart = range.startRow;
    for (;;) {
      const prev = list.find((task) => task.type === type && task.startRow + task.span === cursorStart);
      if (!prev) break;
      total += prev.span;
      cursorStart = prev.startRow;
    }
    let cursorEnd = range.startRow + range.span;
    for (;;) {
      const next = list.find((task) => task.type === type && task.startRow === cursorEnd);
      if (!next) break;
      total += next.span;
      cursorEnd = next.startRow + next.span;
    }
    return total;
  }

  /** Nearest tasks ending before and starting after the range. */
  neighbours(col: number, range: RowRange) {
    const endRow = range.startRow + range.span;
    let prev: GridTask | null = null;
    let next: GridTask | null = null;
    for (const task of this.column(col)) {
      const taskEnd = task.startRow + task.span;
      if (taskEnd <= range.startRow) {
        if (!prev || taskEnd > prev.startRow + prev.span) prev = task;
      } else if (task.startRow >= endRow) {
        if (!next || task.startRow < next.startRow) next = task;
      }
    }
    return { prev, next };
  }

  /** Unoccupied stretches of the column between the two rows. */
  freeSegments(col: number, startRow: number, endRow: number) {
    const list = this.column(col)
      .slice()
      .sort((a, b) => a.startRow - b.startRow);
    const segments: Array<{ startRow: number; endRow: number }> = [];
    let cursor = startRow;
    for (const task of list) {
      if (task.startRow + task.span <= startRow) continue;
      if (task.startRow >= endRow) break;
      if (cursor < task.startRow) segments.push({ startRow: cursor, endRow: Math.min(task.startRow, endRow) });
      cursor = Math.max(cursor, task.startRow + task.span);
      if (cursor >= endRow) break;
    }
    if (cursor < endRow) segments.push({ startRow: cursor, endRow });
    return segments.filter((segment) => segment.endRow > segment.startRow);
  }

  /**
   * Cuts every task in the column around the blocked range, keeping the
   * waiting/packing buffers on the pieces that survive.
   */
  clipColumnAround(col: number, blockedRange: RowRange) {
    const nextTasks: GridTask[] = [];
    for (const task of this.column(col)) {
      const fragments = clipTaskAroundBlockedRange(
        {
          startRow: task.startRow,
          span: task.span,
          waitingMinutes: task.waitingMinutes ?? 0,
          packingMinutes: task.packingMinutes ?? 0,
        },
        blockedRange
      );
      if (fragments.length === 1 && fragments[0].startRow === task.startRow && fragments[0].span === task.span) {
        nextTasks.push(task);
        continue;
      }
      fragments.forEach((fragment, index) => {
        nextTasks.push({
          ...task,
          id: index === 0 ? task.id : this.createId(),
          startRow: fragment.startRow,
          span: fragment.span,
          waitingMinutes: fragment.waitingMinutes ?? 0,
          packingMinutes: fragment.packingMinutes ?? 0,
        });
      });
    }

    const replacedIds = new Set(this.column(col).map((task) => task.id));
    for (let index = this.generated.length - 1; index >= 0; index -= 1) {
      if (replacedIds.has(this.generated[index].id)) this.generated.splice(index, 1);
    }
    const sorted = sortTasks(nextTasks);
    this.tasksByCol.set(col, sorted);
    this.generated.push(...sorted);
    sortTasks(this.generated);
  }
}
