export type RosterEmployee = {
  id: string | number;
  name: string;
  /** Per-day override of the person's usual hours. */
  startTime?: string;
  endTime?: string;
};

export type GridTask = {
  id: string | number;
  type: string;
  label: string;
  /** Grid column; column 1 is the time axis, so employees start at 2. */
  col: number;
  startRow: number;
  span: number;
  color?: string;
  waitingMinutes?: number;
  packingMinutes?: number;
  employeeId?: string | number;
  locked?: boolean;
  isLocked?: boolean;
  readOnly?: boolean;
};

export type SchoolTourEntry = {
  id: string;
  rosterDateId: string;
  startTime: string;
  schoolName: string;
  studentCount: number;
};

export type AutofillNotice = {
  title: string;
  messages: string[];
};

/** Column 1 is the time axis, so the first employee sits in column 2. */
export const FIRST_EMPLOYEE_COL = 2;

export function isTaskLocked(task: GridTask) {
  return task.locked === true || task.isLocked === true || task.readOnly === true;
}

export function createId() {
  return crypto.randomUUID?.() ?? String(Math.random());
}
