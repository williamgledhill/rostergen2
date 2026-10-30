import { isTaskLocked, type GridTask, type RosterEmployee, type SchoolTourEntry } from "@/lib/rosterTypes";
import { isTourTemplate, type TaskTemplate } from "@/lib/taskTemplates";

/**
 * Imported school tours are stored alongside the grid tasks in the roster's
 * task list, marked with this type so they never render as grid blocks.
 */
const SCHOOL_TOUR_RECORD_TYPE = "__school-tour-import";

export type RosterDraftValue = {
  employees: RosterEmployee[];
  tasks: GridTask[];
  schoolTours?: SchoolTourEntry[];
  hoursStart?: string;
  hoursEnd?: string;
};

export function cloneEmployees(input: RosterEmployee[]) {
  return input.map((emp) => ({ ...emp }));
}

export function cloneTasks(input: GridTask[]) {
  return input.map((task) => ({ ...task }));
}

export function cloneSchoolTours(input: SchoolTourEntry[]) {
  return input.map((tour) => ({ ...tour }));
}

export function isSameEmployee(employee: RosterEmployee, candidate: { id: string | number; name: string }) {
  const candidateName = candidate.name.trim().toLowerCase();
  return (
    String(employee.id) === String(candidate.id) ||
    (candidateName.length > 0 && employee.name.trim().toLowerCase() === candidateName)
  );
}

/** Adds any employees from the source that aren't already on the roster. */
export function mergeMissingEmployees(employeeList: RosterEmployee[], sourceEmployees: RosterEmployee[]) {
  const nextEmployees = cloneEmployees(employeeList);
  sourceEmployees.forEach((employee) => {
    if (!nextEmployees.some((existing) => isSameEmployee(existing, employee))) {
      nextEmployees.push({ ...employee });
    }
  });
  return nextEmployees;
}

export function areEmployeesEqual(a: RosterEmployee[], b: RosterEmployee[]) {
  return (
    a.length === b.length &&
    a.every(
      (emp, i) =>
        emp.id === b[i].id && emp.name === b[i].name && emp.startTime === b[i].startTime && emp.endTime === b[i].endTime
    )
  );
}

export function areTasksEqual(a: GridTask[], b: GridTask[]) {
  return (
    a.length === b.length &&
    a.every((x, i) => {
      const y = b[i];
      return (
        x.id === y.id &&
        x.type === y.type &&
        x.label === y.label &&
        x.col === y.col &&
        x.startRow === y.startRow &&
        x.span === y.span &&
        x.color === y.color &&
        x.employeeId === y.employeeId &&
        x.locked === y.locked &&
        x.isLocked === y.isLocked &&
        x.readOnly === y.readOnly
      );
    })
  );
}

/** Grid label for the nth school tour of the day, counting from 0 in start-time order. */
export function schoolTourLabel(index: number) {
  return `School Tour ${index + 1}`;
}

export function sortSchoolTours<T extends Pick<SchoolTourEntry, "startTime" | "schoolName">>(tours: T[]) {
  return tours.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.schoolName.localeCompare(b.schoolName));
}

export function encodeSchoolToursAsTasks(schoolTours: SchoolTourEntry[]) {
  return schoolTours.map((tour, index) => ({
    id: tour.id || `school-tour-${index + 1}`,
    type: SCHOOL_TOUR_RECORD_TYPE,
    label: tour.schoolName,
    col: 0,
    startRow: 0,
    span: 0,
    color: null,
    waitingMinutes: 0,
    packingMinutes: 0,
    employeeId: null,
    locked: false,
    isLocked: false,
    readOnly: true,
    rosterDateId: tour.rosterDateId,
    startTime: tour.startTime,
    schoolName: tour.schoolName,
    studentCount: tour.studentCount,
  }));
}

/** Separates a saved roster's task list into grid tasks and imported school tours. */
export function splitGridTasksAndSchoolTours(input: unknown[]) {
  const gridTasks: GridTask[] = [];
  const schoolTours: SchoolTourEntry[] = [];

  input.forEach((raw, index) => {
    const task = raw as Record<string, unknown> | null;
    if (String(task?.type) !== SCHOOL_TOUR_RECORD_TYPE) {
      gridTasks.push(raw as GridTask);
      return;
    }
    const schoolName = String(task?.schoolName ?? task?.label ?? "").trim();
    const startTime = String(task?.startTime ?? "").trim();
    const rosterDateId = String(task?.rosterDateId ?? "").trim();
    const studentCount = Number(task?.studentCount);
    if (schoolName && startTime && rosterDateId && Number.isFinite(studentCount)) {
      schoolTours.push({
        id: String(task?.id ?? `school-tour-${index + 1}`),
        rosterDateId,
        startTime,
        schoolName,
        studentCount: Math.max(0, Math.round(studentCount)),
      });
    }
  });

  return { gridTasks, schoolTours: sortSchoolTours(schoolTours) };
}

/** A stable fingerprint of everything that gets saved, used to detect unsaved changes. */
export function buildRosterSaveSignature(value: RosterDraftValue, rosterDateId?: string) {
  const persistedTasks = [...value.tasks, ...encodeSchoolToursAsTasks(value.schoolTours ?? [])];
  return JSON.stringify({
    rosterDateId,
    hoursStart: value.hoursStart || "",
    hoursEnd: value.hoursEnd || "",
    employees: value.employees.map((emp) => ({
      id: emp.id,
      name: emp.name,
      startTime: emp.startTime || "",
      endTime: emp.endTime || "",
    })),
    tasks: persistedTasks.map((task) => ({
      id: task.id,
      type: task.type,
      label: task.label,
      col: task.col,
      startRow: task.startRow,
      span: task.span,
      color: task.color || "",
      employeeId: task.employeeId ?? "",
      locked: task.locked === true,
      isLocked: task.isLocked === true,
      readOnly: task.readOnly === true,
    })),
  });
}

/**
 * After a task is resized, trims or removes the neighbours it now overlaps in
 * its column. A neighbour that spans both edges is split in two.
 */
export function consumeOverlappedTasks(tasks: GridTask[], resizedId: GridTask["id"], createId: () => string) {
  const resized = tasks.find((task) => task.id === resizedId);
  if (!resized) return tasks;
  const start = resized.startRow;
  const end = resized.startRow + resized.span;
  const next: GridTask[] = [];

  for (const task of tasks) {
    if (task.id === resized.id) continue;
    if (task.col !== resized.col) {
      next.push(task);
      continue;
    }
    const s = task.startRow;
    const e = task.startRow + task.span;
    if (e <= start || s >= end) {
      next.push(task);
    } else if (s < start && e <= end) {
      next.push({ ...task, span: start - s });
    } else if (s >= start && e > end) {
      next.push({ ...task, startRow: end, span: e - end });
    } else if (s < start && e > end) {
      next.push({ ...task, span: start - s });
      next.push({ ...task, id: createId(), startRow: end, span: e - end });
    }
    // Otherwise the neighbour sits entirely inside the resized task and is dropped.
  }

  next.push(resized);
  return next.sort((a, b) => a.col - b.col || a.startRow - b.startRow);
}

/**
 * Open-ended tasks like Gallery or Front Desk can be joined; tasks with a set
 * length (breaks, briefings), tours, and anything with waiting or packing time
 * keep their own blocks.
 */
export function isMergeableTask(task: GridTask, template: TaskTemplate | undefined) {
  if (!template || isTourTemplate(template) || isTaskLocked(task)) return false;
  if ((template.durationMinutes ?? 0) > 0) return false;
  return !(task.waitingMinutes ?? template.waitingMinutes) && !(task.packingMinutes ?? template.packingMinutes);
}

/**
 * Joins back-to-back blocks of the same task for the same person into one block,
 * so eight 15-minute "Gallery" slots read as a single stretch. Only tasks the
 * caller allows are joined; fixed-length ones like breaks and tours stay apart.
 */
export function mergeAdjacentTasks(tasks: GridTask[], canMerge: (task: GridTask) => boolean) {
  const sorted = [...tasks].sort((a, b) => a.col - b.col || a.startRow - b.startRow);
  const merged: GridTask[] = [];
  for (const task of sorted) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.col === task.col &&
      previous.startRow + previous.span === task.startRow &&
      previous.type === task.type &&
      previous.label === task.label &&
      previous.color === task.color &&
      canMerge(previous) &&
      canMerge(task)
    ) {
      merged[merged.length - 1] = { ...previous, span: previous.span + task.span };
      continue;
    }
    merged.push(task);
  }
  return merged;
}
