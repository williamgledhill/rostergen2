"use client";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import Block from "@/components/Block";
import EmployeeHoursPopover from "@/components/roster/EmployeeHoursPopover";
import EmployeePickerDialog from "@/components/roster/EmployeePickerDialog";
import SchoolTourList from "@/components/roster/SchoolTourList";
import TaskPickerDialog from "@/components/roster/TaskPickerDialog";
import { useFeedback } from "@/components/ui/Feedback";
import { generateAutofillRoster } from "@/lib/autofill/generateRoster";
import { AutosaveState, readDraftRecord, writeDraftRecord } from "@/lib/clientDrafts";
import { formatFullDay, parseLocalId } from "@/lib/dateUtils";
import { buildEditorDraftStorageKey } from "@/lib/editorPersistence";
import { getDayScheduleForDate, type Person } from "@/lib/people";
import { editorDataKey, forgetCachedResources, invalidateWorkspaceResources, rosterDataKey } from "@/lib/workspaceData";
import { formatExportTitle } from "@/lib/rosterExport";
import {
  areEmployeesEqual,
  areTasksEqual,
  buildRosterSaveSignature,
  cloneEmployees,
  cloneSchoolTours,
  cloneTasks,
  consumeOverlappedTasks,
  encodeSchoolToursAsTasks,
  isSameEmployee,
  isMergeableTask,
  mergeAdjacentTasks,
  mergeMissingEmployees,
  schoolTourLabel,
  sortSchoolTours,
  splitGridTasksAndSchoolTours,
  type RosterDraftValue,
} from "@/lib/rosterGrid";
import {
  MIN_ROW,
  clampNumber,
  createRosterTimeline,
  formatMinutesToTime,
  formatShortRange,
  formatShortTime,
  parseTimeToMinutes,
} from "@/lib/rosterTimeline";
import {
  FIRST_EMPLOYEE_COL,
  createId,
  isTaskLocked,
  type AutofillNotice,
  type GridTask,
  type RosterEmployee,
  type SchoolTourEntry,
} from "@/lib/rosterTypes";
import { parseSchoolTourWorkbook } from "@/lib/schoolTourImports";
import { getTaskSegmentRows } from "@/lib/taskSegments";
import {
  TASK_TEMPLATE_REFRESH_EVENT,
  TASK_TEMPLATE_REFRESH_STORAGE_KEY,
  isTourTemplate,
  type TaskTemplate,
} from "@/lib/taskTemplates";

type HistorySnapshot = {
  employees: RosterEmployee[];
  tasks: GridTask[];
};

type SaveMode = "autosave" | "manual";

/** Actions the editor toolbar can trigger on the grid. */
export type GridHandle = {
  autofill: () => void;
  undo: () => void;
  redo: () => void;
  save: () => void;
  exportWorkbook: () => void;
  reset: () => void;
  openEmployeePicker: () => void;
  importSchoolTours: (file: File) => void;
};

export type RosterSaveState = AutosaveState;

/** Roster zoom levels, smallest first. The smallest is the default so a whole day fits on screen. */
export const ROSTER_ZOOM_LEVELS = [
  { rowHeight: 17, columnMin: 80, timeWidth: 72, fontSize: 10.5, headerHeight: 36 },
  { rowHeight: 20, columnMin: 88, timeWidth: 78, fontSize: 11, headerHeight: 38 },
  { rowHeight: 26, columnMin: 104, timeWidth: 86, fontSize: 12, headerHeight: 44 },
  { rowHeight: 36, columnMin: 120, timeWidth: 92, fontSize: 13, headerHeight: 52 },
];
export const DEFAULT_ROSTER_ZOOM = 0;

const MAX_HISTORY_ENTRIES = 100;
const AUTOSAVE_DELAY_MS = 700;
const DEFAULT_TASK_COLOR = "#e2e8f0";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const editable = target.closest("input, textarea, select, [contenteditable], [role='textbox']");
  if (!editable) return false;
  if (editable instanceof HTMLInputElement || editable instanceof HTMLTextAreaElement) return true;
  if (editable instanceof HTMLSelectElement) return true;
  if (editable instanceof HTMLElement && editable.isContentEditable) return true;
  return editable.getAttribute("role") === "textbox";
}

function snapshotFrom(employees: RosterEmployee[], tasks: GridTask[]): HistorySnapshot {
  return { employees: cloneEmployees(employees), tasks: cloneTasks(tasks) };
}

type GridProps = {
  employees: RosterEmployee[];
  initialTasks: GridTask[];
  rosterDateId: string;
  rosterDate: Date;
  hoursStart?: string;
  hoursEnd?: string;
  initialSavedAt?: string;
  people: Person[];
  templates: TaskTemplate[];
  onSaveStateChange?: (state: RosterSaveState) => void;
  onAutofillNoticeChange?: (notice: AutofillNotice | null) => void;
  onRestoreDraftHours?: (hours: { start: string; end: string }) => void;
  /** Index into ROSTER_ZOOM_LEVELS. */
  zoom?: number;
};

const Grid = forwardRef<GridHandle, GridProps>(function Grid(
  {
    employees: initialEmployees,
    initialTasks,
    rosterDateId,
    rosterDate,
    hoursStart,
    hoursEnd,
    initialSavedAt,
    people,
    templates: initialTemplates,
    onSaveStateChange,
    onAutofillNoticeChange,
    onRestoreDraftHours,
    zoom = DEFAULT_ROSTER_ZOOM,
  },
  ref
) {
  const { confirm, notify } = useFeedback();
  const initialSplitRecords = useMemo(() => splitGridTasksAndSchoolTours(initialTasks), [initialTasks]);
  const [employees, setEmployees] = useState<RosterEmployee[]>(initialEmployees);
  const [tasks, setTasks] = useState<GridTask[]>(initialSplitRecords.gridTasks);
  const [schoolTours, setSchoolTours] = useState<SchoolTourEntry[]>(initialSplitRecords.schoolTours);
  const [selected, setSelected] = useState<string | number | undefined>();
  const [hoursPopoverFor, setHoursPopoverFor] = useState<string | number | null>(null);
  const [drag, setDrag] = useState<null | {
    id: string | number;
    which: "top" | "bottom";
    y0: number;
    start0: number;
    span0: number;
  }>(null);
  const [moveDrag, setMoveDrag] = useState<null | { id: string | number; col: number; startRow: number }>(null);
  const [taskPickerSlot, setTaskPickerSlot] = useState<null | { col: number; row: number }>(null);
  const [employeePickerOpen, setEmployeePickerOpen] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>(initialTemplates);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const hoursPopoverRef = useRef<HTMLDivElement>(null);
  const firstTimeCellRef = useRef<HTMLDivElement>(null);
  const prevStartRef = useRef<number | null>(null);
  const prevMaxRef = useRef<number | null>(null);
  const employeesRef = useRef<RosterEmployee[]>(initialEmployees);
  const tasksRef = useRef<GridTask[]>(initialSplitRecords.gridTasks);
  const schoolToursRef = useRef<SchoolTourEntry[]>(initialSplitRecords.schoolTours);
  const hoursRef = useRef<{ start?: string; end?: string }>({ start: hoursStart, end: hoursEnd });
  const historyPastRef = useRef<HistorySnapshot[]>([]);
  const historyFutureRef = useRef<HistorySnapshot[]>([]);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveModeRef = useRef<SaveMode | null>(null);
  const saveCycleRef = useRef(0);
  const autofillRunRef = useRef(0);
  const suspendDraftEffectsRef = useRef(true);
  const lastSavedAtRef = useRef(initialSavedAt);
  const lastSavedSignatureRef = useRef(
    buildRosterSaveSignature(
      {
        employees: initialEmployees,
        tasks: initialSplitRecords.gridTasks,
        schoolTours: initialSplitRecords.schoolTours,
        hoursStart,
        hoursEnd,
      },
      rosterDateId
    )
  );
  const draftStorageKey = useMemo(() => buildEditorDraftStorageKey(rosterDateId), [rosterDateId]);

  const timeline = useMemo(() => createRosterTimeline(hoursStart, hoursEnd), [hoursStart, hoursEnd]);
  const { dayStartMin, dayEndMin, maxRowEx, timeForRow, rowFromTime } = timeline;

  const currentDraft = (): RosterDraftValue => ({
    employees: employeesRef.current,
    tasks: tasksRef.current,
    schoolTours: schoolToursRef.current,
    hoursStart: hoursRef.current.start,
    hoursEnd: hoursRef.current.end,
  });

  // ---- History ----

  const pushHistorySnapshot = useCallback((employeeList: RosterEmployee[], taskList: GridTask[]) => {
    historyPastRef.current.push(snapshotFrom(employeeList, taskList));
    if (historyPastRef.current.length > MAX_HISTORY_ENTRIES) historyPastRef.current.shift();
    historyFutureRef.current = [];
  }, []);

  const setRosterState = useCallback((nextEmployees: RosterEmployee[], nextTasks: GridTask[]) => {
    employeesRef.current = nextEmployees;
    tasksRef.current = nextTasks;
    setEmployees(nextEmployees);
    setTasks(nextTasks);
  }, []);

  /** Applies a change as one undoable step. Returns false when nothing changed. */
  const applyRosterState = useCallback(
    (nextEmployees: RosterEmployee[], nextTasks: GridTask[]) => {
      const prevEmployees = employeesRef.current;
      const prevTasks = tasksRef.current;
      if (areEmployeesEqual(prevEmployees, nextEmployees) && areTasksEqual(prevTasks, nextTasks)) return false;
      pushHistorySnapshot(prevEmployees, prevTasks);
      setRosterState(nextEmployees, nextTasks);
      return true;
    },
    [pushHistorySnapshot, setRosterState]
  );

  const undo = useCallback(() => {
    const previous = historyPastRef.current.pop();
    if (!previous) return;
    historyFutureRef.current.push(snapshotFrom(employeesRef.current, tasksRef.current));
    setRosterState(cloneEmployees(previous.employees), cloneTasks(previous.tasks));
    setSelected(undefined);
  }, [setRosterState]);

  const redo = useCallback(() => {
    const next = historyFutureRef.current.pop();
    if (!next) return;
    historyPastRef.current.push(snapshotFrom(employeesRef.current, tasksRef.current));
    if (historyPastRef.current.length > MAX_HISTORY_ENTRIES) historyPastRef.current.shift();
    setRosterState(cloneEmployees(next.employees), cloneTasks(next.tasks));
    setSelected(undefined);
  }, [setRosterState]);

  const setSchoolToursState = useCallback((next: SchoolTourEntry[]) => {
    schoolToursRef.current = next;
    setSchoolTours(next);
  }, []);

  // ---- Loading the day and restoring unsaved drafts ----

  useEffect(() => {
    suspendDraftEffectsRef.current = true;
    const serverDraftValue: RosterDraftValue = {
      employees: cloneEmployees(initialEmployees),
      tasks: cloneTasks(initialSplitRecords.gridTasks),
      schoolTours: cloneSchoolTours(initialSplitRecords.schoolTours),
      hoursStart,
      hoursEnd,
    };
    const serverSignature = buildRosterSaveSignature(serverDraftValue, rosterDateId);
    const persistedDraft = readDraftRecord<RosterDraftValue>(draftStorageKey);
    const persistedValue = persistedDraft?.value ?? serverDraftValue;
    const persistedSignature = buildRosterSaveSignature(persistedValue, rosterDateId);
    const nextLastSavedSignature = persistedDraft?.lastSavedSignature ?? serverSignature;
    const hasLocalDraftChanges = persistedDraft !== null && persistedSignature !== nextLastSavedSignature;
    const serverChangedSinceDraft = persistedDraft !== null && nextLastSavedSignature !== serverSignature;
    // Keep unsaved local edits, but pick up anyone added to the roster elsewhere since.
    const nextDraftValue: RosterDraftValue =
      hasLocalDraftChanges && serverChangedSinceDraft
        ? {
            ...persistedValue,
            employees: mergeMissingEmployees(persistedValue.employees, serverDraftValue.employees),
          }
        : hasLocalDraftChanges
          ? persistedValue
          : serverDraftValue;
    const nextDraftSignature = buildRosterSaveSignature(nextDraftValue, rosterDateId);
    const nextSavedAt = hasLocalDraftChanges ? (persistedDraft?.savedAt ?? initialSavedAt) : initialSavedAt;

    setRosterState(cloneEmployees(nextDraftValue.employees), cloneTasks(nextDraftValue.tasks));
    setSchoolToursState(cloneSchoolTours(nextDraftValue.schoolTours ?? []));
    historyPastRef.current = [];
    historyFutureRef.current = [];
    setSelected(undefined);
    setHoursPopoverFor(null);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    autofillRunRef.current = 0;
    lastSavedAtRef.current = nextSavedAt;
    lastSavedSignatureRef.current = hasLocalDraftChanges ? nextLastSavedSignature : serverSignature;
    writeDraftRecord<RosterDraftValue>(draftStorageKey, {
      value: nextDraftValue,
      lastSavedSignature: lastSavedSignatureRef.current,
      savedAt: lastSavedAtRef.current,
    });
    if (hasLocalDraftChanges) {
      onRestoreDraftHours?.({
        start: nextDraftValue.hoursStart || hoursStart || "",
        end: nextDraftValue.hoursEnd || hoursEnd || "",
      });
    }
    saveCycleRef.current += 1;
    queuedSaveModeRef.current = null;
    onSaveStateChange?.(
      nextDraftSignature !== lastSavedSignatureRef.current
        ? { state: "dirty", mode: "autosave", savedAt: lastSavedAtRef.current }
        : lastSavedAtRef.current
          ? { state: "saved", savedAt: lastSavedAtRef.current }
          : { state: "idle" }
    );
    queueMicrotask(() => {
      suspendDraftEffectsRef.current = false;
    });
    // Hours are deliberately left out: this should only re-run when a different
    // day or a fresh server copy arrives, not while the user edits the hours.
  }, [
    draftStorageKey,
    initialEmployees,
    initialSavedAt,
    initialTasks,
    initialSplitRecords,
    onRestoreDraftHours,
    onSaveStateChange,
    rosterDateId,
    setRosterState,
    setSchoolToursState,
  ]);

  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    hoursRef.current = { start: hoursStart, end: hoursEnd };
  }, [hoursStart, hoursEnd]);

  // Keep a copy of unsaved work in session storage so a reload doesn't lose it.
  useEffect(() => {
    if (suspendDraftEffectsRef.current) return;
    writeDraftRecord<RosterDraftValue>(draftStorageKey, {
      value: {
        employees: cloneEmployees(employees),
        tasks: cloneTasks(tasks),
        schoolTours: cloneSchoolTours(schoolTours),
        hoursStart,
        hoursEnd,
      },
      lastSavedSignature: lastSavedSignatureRef.current,
      savedAt: lastSavedAtRef.current,
    });
  }, [draftStorageKey, employees, hoursEnd, hoursStart, schoolTours, tasks]);

  useEffect(() => {
    if (selected !== undefined && !tasks.some((task) => task.id === selected)) setSelected(undefined);
  }, [tasks, selected]);

  useEffect(() => {
    if (hoursPopoverFor === null) return;
    if (!employees.some((emp) => emp.id === hoursPopoverFor)) {
      setHoursPopoverFor(null);
      return;
    }
    const onOutsideClick = (e: MouseEvent) => {
      if (hoursPopoverRef.current?.contains(e.target as Node)) return;
      setHoursPopoverFor(null);
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [hoursPopoverFor, employees]);

  // When the day's start time moves, shift tasks so they stay at the same clock time.
  useEffect(() => {
    if (prevStartRef.current === null) {
      prevStartRef.current = dayStartMin;
      prevMaxRef.current = maxRowEx;
      return;
    }
    const offset = Math.round((prevStartRef.current - dayStartMin) / 15);
    const needsClamp = (prevMaxRef.current ?? maxRowEx) !== maxRowEx;
    prevStartRef.current = dayStartMin;
    prevMaxRef.current = maxRowEx;
    if (offset === 0 && !needsClamp) return;
    setTasks((prev) =>
      prev
        .map((task) => {
          const shiftedStart = task.startRow + offset;
          const start = clampNumber(shiftedStart, MIN_ROW, maxRowEx - 1);
          const end = clampNumber(shiftedStart + task.span, MIN_ROW + 1, maxRowEx);
          return { ...task, startRow: start, span: Math.max(1, end - start) };
        })
        .filter((task) => task.startRow < maxRowEx && task.startRow + task.span > MIN_ROW)
        .sort((a, b) => a.col - b.col || a.startRow - b.startRow)
    );
  }, [dayStartMin, maxRowEx]);

  // ---- Task templates, kept fresh when edited in another tab ----

  const refreshTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/task-templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load task templates");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    // The editor has only just loaded these, so refresh later (on focus) rather than now.
    setTemplates(initialTemplates);

    const handleRefresh = () => void refreshTemplates();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === TASK_TEMPLATE_REFRESH_STORAGE_KEY) handleRefresh();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") handleRefresh();
    };

    window.addEventListener("focus", handleRefresh);
    window.addEventListener(TASK_TEMPLATE_REFRESH_EVENT, handleRefresh);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener(TASK_TEMPLATE_REFRESH_EVENT, handleRefresh);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initialTemplates, refreshTemplates]);

  const templateById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const colorForTask = useCallback(
    (task: Pick<GridTask, "type" | "color">) => templateById.get(task.type)?.color || task.color || DEFAULT_TASK_COLOR,
    [templateById]
  );
  const segmentsForTask = useCallback(
    (task: GridTask) => {
      const template = templateById.get(task.type);
      return getTaskSegmentRows({
        span: task.span,
        waitingMinutes: (task.waitingMinutes ?? template?.waitingMinutes) || 0,
        packingMinutes: (task.packingMinutes ?? template?.packingMinutes) || 0,
      });
    },
    [templateById]
  );

  const mergeTasks = useCallback(
    (list: GridTask[]) => mergeAdjacentTasks(list, (task) => isMergeableTask(task, templateById.get(task.type))),
    [templateById]
  );

  const waitingLabelForTask = useCallback(
    (task: GridTask) => (isTourTemplate(templateById.get(task.type)) ? "Waiting for tour" : "Waiting for"),
    [templateById]
  );

  // ---- Employees ----

  const employeeCols = useMemo(
    () => employees.map((emp, idx) => ({ ...emp, col: idx + FIRST_EMPLOYEE_COL })),
    [employees]
  );
  const peopleById = useMemo(() => new Map(people.map((p) => [String(p.id), p])), [people]);
  const peopleByName = useMemo(() => new Map(people.map((p) => [p.name.toLowerCase(), p])), [people]);

  /** The employee's hours today: their override, else their schedule, else the whole day. */
  const resolveEmployeeHours = useCallback(
    (emp: RosterEmployee) => {
      const overrideStart = parseTimeToMinutes(emp.startTime);
      const overrideEnd = parseTimeToMinutes(emp.endTime);
      if (overrideStart !== null && overrideEnd !== null && overrideStart < overrideEnd) {
        return { start: emp.startTime as string, end: emp.endTime as string, isOff: false };
      }
      const person = peopleById.get(String(emp.id)) || peopleByName.get(String(emp.name || "").toLowerCase());
      const schedule = person ? getDayScheduleForDate(person, rosterDate) : null;
      if (schedule?.enabled) return { start: schedule.start, end: schedule.end, isOff: false };
      return {
        start: formatMinutesToTime(dayStartMin),
        end: formatMinutesToTime(dayEndMin),
        isOff: !!schedule,
      };
    },
    [peopleById, peopleByName, rosterDate, dayStartMin, dayEndMin]
  );

  const addEmployee = useCallback(
    (person: Person) => {
      const prevEmployees = employeesRef.current;
      if (prevEmployees.some((emp) => isSameEmployee(emp, person))) return;
      applyRosterState([...prevEmployees, { id: person.id, name: person.name }], tasksRef.current);
    },
    [applyRosterState]
  );

  const removeEmployee = useCallback(
    async (id: string | number, options?: { skipConfirm?: boolean }) => {
      const target = employeesRef.current.find((e) => e.id === id);
      if (!target) return;
      if (
        !options?.skipConfirm &&
        !(await confirm({
          title: `Remove ${target.name} from this day?`,
          message: "Their tasks on this day are removed too. You can undo this.",
          confirmLabel: "Remove",
          tone: "danger",
        }))
      ) {
        return;
      }
      const prevEmployees = employeesRef.current;
      const idx = prevEmployees.findIndex((e) => e.id === id);
      if (idx === -1) return;
      const colToRemove = idx + FIRST_EMPLOYEE_COL;
      const nextTasks = tasksRef.current
        .filter((t) => t.col !== colToRemove)
        .map((t) => (t.col > colToRemove ? { ...t, col: t.col - 1 } : t));
      applyRosterState(
        prevEmployees.filter((e) => e.id !== id),
        nextTasks
      );
      setHoursPopoverFor((current) => (current === id ? null : current));
    },
    [applyRosterState, confirm]
  );

  const removeEmployeeFromPicker = useCallback(
    (person: Person) => {
      const target = employeesRef.current.find((employee) => isSameEmployee(employee, person));
      if (target) void removeEmployee(target.id, { skipConfirm: true });
    },
    [removeEmployee]
  );

  const setEmployeeHoursOverride = useCallback(
    (id: string | number, hours: { start: string; end: string } | null) => {
      const current = employeesRef.current.find((emp) => emp.id === id);
      if (!current) return;
      if (hours && current.startTime === hours.start && current.endTime === hours.end) return;
      const nextEmployees = employeesRef.current.map((emp) =>
        emp.id === id ? { ...emp, startTime: hours?.start, endTime: hours?.end } : emp
      );
      applyRosterState(nextEmployees, tasksRef.current);
    },
    [applyRosterState]
  );

  /** Back to everyone rostered on for the day, with no tasks. School tours are kept. */
  const resetRoster = useCallback(async () => {
    const confirmed = await confirm({
      title: "Reset this day?",
      message: "All tasks are cleared and the day's usual staff are restored. Imported school tours are kept. You can undo this.",
      confirmLabel: "Reset",
      tone: "danger",
    });
    if (!confirmed) return;
    const working = people
      .filter((person) => getDayScheduleForDate(person, rosterDate).enabled)
      .map((person) => ({ id: person.id, name: person.name }));
    applyRosterState(working.length ? working : initialEmployees, []);
    setSelected(undefined);
  }, [people, rosterDate, initialEmployees, applyRosterState, confirm]);

  // ---- School tours ----

  const importSchoolTours = useCallback(
    async (file: File) => {
      const importedRows = parseSchoolTourWorkbook(await file.arrayBuffer());
      if (importedRows.length === 0) throw new Error("No school tour rows were found in the workbook.");

      let rowsToAdd = importedRows.filter((row) => row.rosterDateId === rosterDateId);
      const otherDateCount = importedRows.length - rowsToAdd.length;
      if (rowsToAdd.length === 0) {
        // Nothing is for this day: check before moving another day's bookings here.
        const describeDate = (dateId: string) => {
          const date = parseLocalId(dateId);
          return date ? formatFullDay(date) : dateId;
        };
        const foundDates = Array.from(new Set(importedRows.map((row) => row.rosterDateId))).map(describeDate);
        const confirmed = await confirm({
          title: "These school tours are for a different day",
          message: `The spreadsheet has ${importedRows.length} school tour${importedRows.length === 1 ? "" : "s"} for ${foundDates.join(", ")}, not ${formatFullDay(rosterDate)}. Add them to this day anyway?`,
          confirmLabel: "Add to this day",
        });
        if (!confirmed) return;
        rowsToAdd = importedRows.map((row) => ({ ...row, rosterDateId }));
      }

      const tourKey = (tour: Omit<SchoolTourEntry, "id">) =>
        `${tour.rosterDateId}|${tour.startTime}|${tour.schoolName.toLowerCase()}|${tour.studentCount}`;
      const toursByKey = new Map(schoolToursRef.current.map((tour) => [tourKey(tour), tour]));
      rowsToAdd.forEach((row) => {
        if (!toursByKey.has(tourKey(row))) toursByKey.set(tourKey(row), { id: createId(), ...row });
      });
      setSchoolToursState(sortSchoolTours(Array.from(toursByKey.values())));
      notify({
        tone: "success",
        title: `Imported ${rowsToAdd.length} school tour${rowsToAdd.length === 1 ? "" : "s"}`,
        message:
          otherDateCount > 0 && rowsToAdd.length < importedRows.length
            ? `${otherDateCount} for other dates ${otherDateCount === 1 ? "was" : "were"} left out. Autofill will place the rest at their booked times.`
            : "Autofill will place them at their booked times.",
      });
    },
    [rosterDateId, rosterDate, setSchoolToursState, notify, confirm]
  );

  // ---- Autofill ----

  const autofill = useCallback(() => {
    const variant = autofillRunRef.current;
    autofillRunRef.current += 1;
    const result = generateAutofillRoster({
      employees,
      people,
      templates,
      schoolTours,
      rosterDate,
      timeline,
      variant,
    });
    applyRosterState(employees, result.tasks);
    if (result.notice !== undefined) onAutofillNoticeChange?.(result.notice);
  }, [employees, people, templates, schoolTours, rosterDate, timeline, applyRosterState, onAutofillNoticeChange]);

  // ---- Saving ----

  const saveRoster = useCallback(
    async (options?: { mode?: SaveMode; keepalive?: boolean }) => {
      const mode = options?.mode ?? "manual";
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      if (saveInFlightRef.current) {
        queuedSaveModeRef.current = mode;
        return;
      }

      const snapshot: RosterDraftValue = {
        employees: cloneEmployees(employeesRef.current),
        tasks: cloneTasks(tasksRef.current),
        schoolTours: cloneSchoolTours(schoolToursRef.current),
        hoursStart: hoursRef.current.start,
        hoursEnd: hoursRef.current.end,
      };
      const nextSignature = buildRosterSaveSignature(snapshot, rosterDateId);
      if (nextSignature === lastSavedSignatureRef.current) return;

      saveInFlightRef.current = true;
      const saveCycle = saveCycleRef.current;
      onSaveStateChange?.({ state: "saving", mode });

      try {
        const res = await fetch("/api/rosters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: rosterDateId,
            employees: snapshot.employees,
            tasks: [...snapshot.tasks, ...encodeSchoolToursAsTasks(snapshot.schoolTours ?? [])],
            hoursStart: snapshot.hoursStart,
            hoursEnd: snapshot.hoursEnd,
          }),
          keepalive: options?.keepalive,
        });
        if (!res.ok) throw new Error(`Save failed: ${await res.text()}`);

        const payload = (await res.json().catch(() => ({}))) as { savedAt?: string };
        if (saveCycle === saveCycleRef.current) {
          lastSavedSignatureRef.current = nextSignature;
          lastSavedAtRef.current = typeof payload.savedAt === "string" ? payload.savedAt : new Date().toISOString();
          writeDraftRecord<RosterDraftValue>(draftStorageKey, {
            value: snapshot,
            lastSavedSignature: nextSignature,
            savedAt: lastSavedAtRef.current,
          });
          onSaveStateChange?.({ state: "saved", mode, savedAt: lastSavedAtRef.current });
          // Coming back to this day (or the roster list) should load what was just saved.
          forgetCachedResources([editorDataKey(rosterDateId)]);
          invalidateWorkspaceResources([rosterDataKey(), "rosters-month"]);
        }
      } catch (err) {
        console.error(err);
        if (saveCycle === saveCycleRef.current) {
          writeDraftRecord<RosterDraftValue>(draftStorageKey, {
            value: snapshot,
            lastSavedSignature: lastSavedSignatureRef.current,
            savedAt: lastSavedAtRef.current,
          });
          onSaveStateChange?.({ state: "error", mode });
        }
      } finally {
        saveInFlightRef.current = false;
        const queuedMode = queuedSaveModeRef.current;
        if (queuedMode) {
          queuedSaveModeRef.current = null;
          void saveRoster({ mode: queuedMode });
        }
      }
    },
    [draftStorageKey, rosterDateId, onSaveStateChange]
  );

  useEffect(() => {
    if (suspendDraftEffectsRef.current) return;
    const signature = buildRosterSaveSignature({ employees, tasks, schoolTours, hoursStart, hoursEnd }, rosterDateId);
    if (signature === lastSavedSignatureRef.current) return;
    onSaveStateChange?.({ state: "dirty", mode: "autosave", savedAt: lastSavedAtRef.current });
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => void saveRoster({ mode: "autosave" }), AUTOSAVE_DELAY_MS);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [employees, schoolTours, tasks, hoursStart, hoursEnd, rosterDateId, saveRoster, onSaveStateChange]);

  // Save straight away if the tab is hidden or closed with changes pending.
  useEffect(() => {
    const flushAutosave = () => {
      if (buildRosterSaveSignature(currentDraft(), rosterDateId) === lastSavedSignatureRef.current) return;
      void saveRoster({ mode: "autosave", keepalive: true });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushAutosave();
    };
    window.addEventListener("pagehide", flushAutosave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushAutosave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [rosterDateId, saveRoster]);

  // ---- Selection and editing ----

  const deleteSelectedTask = useCallback(() => {
    if (selected === undefined) return;
    const target = tasksRef.current.find((task) => task.id === selected);
    if (!target || isTaskLocked(target)) return;
    if (applyRosterState(employeesRef.current, tasksRef.current.filter((task) => task.id !== selected))) {
      setSelected(undefined);
    }
  }, [selected, applyRosterState]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current?.contains(e.target as Node)) return;
      setSelected(undefined);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (selected === undefined) return;
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      deleteSelectedTask();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, deleteSelectedTask]);

  const exportWorkbook = useCallback(async () => {
    const title = formatExportTitle(rosterDate);
    try {
      // Loaded on demand: the spreadsheet library is large and only needed here.
      const { buildRosterWorkbook, downloadWorkbook } = await import("@/lib/rosterExport");
      const buffer = await buildRosterWorkbook({
        title,
        dayStartMin,
        dayEndMin,
        columns: employeeCols.map((emp) => {
          const hours = resolveEmployeeHours(emp);
          return {
            col: emp.col,
            name: emp.name,
            hoursLabel: hours.isOff ? "Off" : `${formatShortTime(hours.start)}-${formatShortTime(hours.end)}`,
          };
        }),
        tasks,
        colorForTask,
        segmentsForTask,
        waitingLabelForTask,
        notes: sortSchoolTours([...schoolTours]).map(
          (tour, index) =>
            `${schoolTourLabel(index)}: ${formatShortTime(tour.startTime)} ${tour.schoolName} (${tour.studentCount} students)`
        ),
      });
      downloadWorkbook(buffer as ArrayBuffer, title);
    } catch (error) {
      console.error(error);
      notify({ tone: "error", title: "Couldn't export the roster", message: "Please try again." });
    }
  }, [rosterDate, dayStartMin, dayEndMin, employeeCols, resolveEmployeeHours, tasks, schoolTours, colorForTask, segmentsForTask, waitingLabelForTask, notify]);

  useImperativeHandle(
    ref,
    () => ({
      autofill,
      undo,
      redo,
      save: () => void saveRoster(),
      exportWorkbook: () => void exportWorkbook(),
      reset: () => void resetRoster(),
      openEmployeePicker: () => setEmployeePickerOpen(true),
      importSchoolTours: (file: File) => {
        importSchoolTours(file).catch((error) => {
          notify({
            tone: "error",
            title: "Couldn't import school tours",
            message: error instanceof Error ? error.message : undefined,
          });
        });
      },
    }),
    [autofill, undo, redo, saveRoster, exportWorkbook, resetRoster, importSchoolTours, notify]
  );

  function createTaskFromTemplate(template: TaskTemplate) {
    if (!taskPickerSlot) return;
    const id = createId();
    const waitingMinutes = template.waitingMinutes || 0;
    const packingMinutes = template.packingMinutes || 0;
    // Tasks with a set length (and every tour) go in at full length; others fill one slot to start.
    const fullMinutes = (template.durationMinutes || 60) + waitingMinutes + packingMinutes;
    const hasSetLength = (template.durationMinutes ?? 0) > 0 || isTourTemplate(template);
    const span = Math.max(
      1,
      Math.min(hasSetLength ? Math.ceil(fullMinutes / 15) : 1, maxRowEx - taskPickerSlot.row)
    );
    const employee = employeesRef.current[taskPickerSlot.col - FIRST_EMPLOYEE_COL];
    const nextTasks = [
      ...tasksRef.current,
      {
        id,
        type: template.id || "task",
        label: template.name || "Task",
        col: taskPickerSlot.col,
        startRow: taskPickerSlot.row,
        span,
        color: template.color,
        waitingMinutes,
        packingMinutes,
        employeeId: employee?.id,
      },
    ];
    applyRosterState(employeesRef.current, mergeTasks(consumeOverlappedTasks(nextTasks, id, createId)));
    setSelected(id);
    setTaskPickerSlot(null);
  }

  // ---- Resizing: dragging a task's edge swallows or trims its neighbours ----

  function onStartResize(which: "top" | "bottom", id: string | number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const task = tasksRef.current.find((x) => x.id === id);
    if (!task) return;
    pushHistorySnapshot(employeesRef.current, tasksRef.current);
    setDrag({ id, which, y0: e.clientY, start0: task.startRow, span0: task.span });
  }

  useEffect(() => {
    if (!drag) return;
    const rowHeight = firstTimeCellRef.current?.getBoundingClientRect().height ?? 44;
    const onMove = (e: MouseEvent) => {
      const dRows = Math.round((e.clientY - drag.y0) / rowHeight);
      let newStart = drag.start0;
      let newSpan = drag.span0;
      if (drag.which === "top") {
        newStart = Math.max(MIN_ROW, Math.min(drag.start0 + dRows, drag.start0 + drag.span0 - 1));
        newSpan = drag.start0 + drag.span0 - newStart;
      } else {
        const newEnd = Math.min(maxRowEx, Math.max(drag.start0 + drag.span0 + dRows, drag.start0 + 1));
        newSpan = newEnd - drag.start0;
      }
      setTasks((prev) => prev.map((x) => (x.id === drag.id ? { ...x, startRow: newStart, span: newSpan } : x)));
    };
    const onUp = () => {
      setTasks((prev) => mergeTasks(consumeOverlappedTasks(prev, drag.id, createId)));
      setDrag(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "ns-resize";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
  }, [drag, maxRowEx, mergeTasks]);

  // ---- Moving: drag a task or tour to another time or person ----

  function onStartMove(id: string | number, e: React.MouseEvent) {
    if (e.button !== 0) return;
    const task = tasksRef.current.find((x) => x.id === id);
    const grid = gridRef.current;
    const timeCell = firstTimeCellRef.current;
    if (!task || isTaskLocked(task) || !grid || !timeCell) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const rowHeight = timeCell.offsetHeight;
    const timeWidth = timeCell.offsetWidth;
    const headerHeight = timeCell.offsetTop;
    const colCount = employeesRef.current.length;
    // Keep the task under the pointer at the row where it was grabbed.
    const grabOffset =
      Math.floor((startY - grid.getBoundingClientRect().top - headerHeight) / rowHeight) - (task.startRow - MIN_ROW);
    const lastStartRow = Math.max(MIN_ROW, maxRowEx - task.span);
    let moved = false;
    let target = { col: task.col, startRow: task.startRow };

    const onMove = (ev: MouseEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
      moved = true;
      const rect = grid.getBoundingClientRect();
      const colWidth = (rect.width - timeWidth) / colCount;
      const col = clampNumber(
        FIRST_EMPLOYEE_COL + Math.floor((ev.clientX - rect.left - timeWidth) / colWidth),
        FIRST_EMPLOYEE_COL,
        FIRST_EMPLOYEE_COL + colCount - 1
      );
      const pointerRow = MIN_ROW + Math.floor((ev.clientY - rect.top - headerHeight) / rowHeight);
      target = { col, startRow: clampNumber(pointerRow - grabOffset, MIN_ROW, lastStartRow) };
      setMoveDrag({ id, ...target });
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      setMoveDrag(null);
      if (!moved || (target.col === task.col && target.startRow === task.startRow)) return;
      const employee = employeesRef.current[target.col - FIRST_EMPLOYEE_COL];
      const movedTasks = tasksRef.current.map((x) =>
        x.id === id ? { ...x, ...target, employeeId: employee?.id ?? x.employeeId } : x
      );
      applyRosterState(employeesRef.current, mergeTasks(consumeOverlappedTasks(movedTasks, id, createId)));
      setSelected(id);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "grabbing";
  }

  // ---- Render ----

  const zoomLevel = ROSTER_ZOOM_LEVELS[zoom] ?? ROSTER_ZOOM_LEVELS[DEFAULT_ROSTER_ZOOM];
  const zoomStyle = {
    "--rowh": `${zoomLevel.rowHeight}px`,
    "--empw": `${zoomLevel.columnMin}px`,
    "--timew": `${zoomLevel.timeWidth}px`,
    "--grid-font": `${zoomLevel.fontSize}px`,
    "--headerh": `${zoomLevel.headerHeight}px`,
  } as React.CSSProperties;

  // A task being dragged no longer occupies its old spot, so that spot shows as empty.
  const occupied = new Set(
    tasks
      .filter((task) => task.id !== moveDrag?.id)
      .flatMap((task) => Array.from({ length: task.span }, (_, i) => `${task.col}:${task.startRow + i}`))
  );
  const emptySlots = employeeCols.flatMap((column) =>
    Array.from({ length: maxRowEx - MIN_ROW }, (_, i) => MIN_ROW + i)
      .filter((row) => !occupied.has(`${column.col}:${row}`))
      .map((row) => ({ col: column.col, row }))
  );
  const lastGridRow = maxRowEx - 1;
  const popoverEmployee = employees.find((emp) => emp.id === hoursPopoverFor);

  const lineBottom = (row: number) => (row === lastGridRow ? "" : "inset 0 -1px 0 var(--grid-line)");
  const shadows = (...values: string[]) => values.filter(Boolean).join(", ") || undefined;

  // Like the printed roster, only a person's working hours show faint slot lines.
  const shiftByCol = new Map(
    employeeCols.map((column) => {
      const hours = resolveEmployeeHours(column);
      const startRow = hours.isOff ? null : rowFromTime(hours.start, "floor");
      const endRow = hours.isOff ? null : rowFromTime(hours.end, "ceil");
      return [column.col, startRow !== null && endRow !== null ? { startRow, endRow } : null];
    })
  );
  const inShift = (col: number, row: number) => {
    const shift = shiftByCol.get(col);
    return !!shift && row >= shift.startRow && row < shift.endRow;
  };

  // Half-hour time labels, falling back to a single slot where the day doesn't line up.
  const timeLabels: Array<{ row: number; span: number }> = [];
  for (let row = MIN_ROW; row < maxRowEx; ) {
    const startMin = dayStartMin + (row - MIN_ROW) * 15;
    const span = startMin % 30 === 0 && row + 1 < maxRowEx ? 2 : 1;
    timeLabels.push({ row, span });
    row += span;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="card max-h-[calc(100vh-228px)] min-h-[320px] w-full overflow-auto"
        style={zoomStyle}
        onClick={() => setSelected(undefined)}
      >
        <div
          ref={gridRef}
          className="grid min-w-full"
          style={{
            // Columns share the width available and only scroll once they reach their minimum.
            gridTemplateColumns: `var(--timew) repeat(${employeeCols.length}, minmax(var(--empw), 1fr))`,
            gridTemplateRows: "var(--headerh)",
            gridAutoRows: "var(--rowh)",
          }}
        >
          <div className="sticky left-0 top-0 z-40 bg-white" aria-hidden="true" />
          {employeeCols.map((column) => {
            const resolved = resolveEmployeeHours(column);
            const hasOverride = !!(column.startTime && column.endTime);
            const popoverOpen = hoursPopoverFor === column.id;
            return (
              <div
                key={column.id}
                ref={popoverOpen ? hoursPopoverRef : undefined}
                className="sticky top-0 z-30 bg-white"
                style={{ boxShadow: "inset -1px 0 0 var(--block-line), inset 0 -1px 0 var(--block-line), inset 0 1px 0 var(--block-line)" }}
              >
                <button
                  type="button"
                  className={`flex h-full w-full min-w-0 flex-col text-center transition-colors hover:bg-[var(--surface-subtle)] focus-visible:bg-[var(--surface-subtle)] focus-visible:outline-none ${
                    popoverOpen ? "bg-[var(--surface-subtle)]" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setHoursPopoverFor((current) => (current === column.id ? null : column.id));
                  }}
                  title={`${column.name}: change hours for this day`}
                  aria-label={`Hours for ${column.name}`}
                  aria-expanded={popoverOpen}
                >
                  <span className="flex w-full flex-1 items-center justify-center truncate px-1.5 text-[length:calc(var(--grid-font)+1px)] leading-tight">
                    {column.name}
                  </span>
                  <span
                    className={`flex w-full flex-1 items-center justify-center truncate border-t border-[var(--block-line)] px-1.5 text-[length:var(--grid-font)] tabular-nums ${
                      resolved.isOff
                        ? "italic text-[var(--text-faint)]"
                        : hasOverride
                          ? "font-medium text-[var(--accent-strong)]"
                          : ""
                    }`}
                  >
                    {resolved.isOff ? "Not rostered" : `${formatShortTime(resolved.start)}-${formatShortTime(resolved.end)}`}
                  </span>
                </button>
                {popoverEmployee && popoverOpen && (
                  <EmployeeHoursPopover
                    employeeName={column.name}
                    initialHours={{ start: resolved.start, end: resolved.end }}
                    onApply={(hours) => setEmployeeHoursOverride(column.id, hours)}
                    onUseDefault={() => {
                      setEmployeeHoursOverride(column.id, null);
                      setHoursPopoverFor(null);
                    }}
                    onRemove={() => {
                      setHoursPopoverFor(null);
                      void removeEmployee(column.id);
                    }}
                  />
                )}
              </div>
            );
          })}

          {/* One-row marker the drag and resize code measures row height and header offset from. */}
          <div
            ref={firstTimeCellRef}
            aria-hidden="true"
            className="pointer-events-none invisible"
            style={{ gridColumn: "1", gridRow: String(MIN_ROW) }}
          />
          {timeLabels.map(({ row, span }) => {
            const startMin = dayStartMin + (row - MIN_ROW) * 15;
            return (
              <div
                key={`time-${row}`}
                className="sticky left-0 z-20 flex items-center justify-center bg-white text-[length:var(--grid-font)] tabular-nums"
                style={{
                  gridColumn: "1",
                  gridRow: `${row} / span ${span}`,
                  boxShadow: "inset -1px 0 0 var(--block-line), inset 1px 0 0 var(--block-line), inset 0 -1px 0 var(--block-line)",
                }}
              >
                {formatShortRange(startMin, startMin + span * 15)}
              </div>
            );
          })}

          {emptySlots.map((slot) => (
            <button
              type="button"
              key={`slot-${slot.col}-${slot.row}`}
              className="group relative overflow-hidden bg-white transition-colors hover:bg-[var(--accent-soft)] focus-visible:bg-[var(--accent-soft)] focus-visible:outline-none"
              style={{
                gridColumn: String(slot.col),
                gridRow: String(slot.row),
                boxShadow: inShift(slot.col, slot.row)
                  ? shadows("inset -1px 0 0 var(--grid-line)", lineBottom(slot.row))
                  : undefined,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setTaskPickerSlot(slot);
              }}
              aria-label={`Add task at ${timeForRow(slot.row)}`}
            >
              <span className="text-[length:calc(var(--grid-font)+3px)] font-medium leading-none text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                +
              </span>
            </button>
          ))}

          {tasks.map((task) => {
            const preview = moveDrag?.id === task.id ? moveDrag : null;
            const col = preview?.col ?? task.col;
            const startRow = preview?.startRow ?? task.startRow;
            return (
              <Block
                key={task.id}
                id={task.id}
                label={task.label}
                col={col}
                startRow={startRow}
                span={task.span}
                color={colorForTask(task)}
                segments={segmentsForTask(task)}
                selected={task.id === selected}
                dragging={!!preview}
                waitingLabel={waitingLabelForTask(task)}
                // Neighbouring blocks share one line rather than doubling up.
                drawTop={!occupied.has(`${col}:${startRow - 1}`)}
                drawLeft={col === FIRST_EMPLOYEE_COL || !occupied.has(`${col - 1}:${startRow}`)}
                onSelect={() => setSelected(task.id)}
                onStartMove={(e) => onStartMove(task.id, e)}
                onStartResize={(which, e) => onStartResize(which, task.id, e)}
              />
            );
          })}
        </div>

        {employeeCols.length === 0 && (
          <div className="px-6 py-10 text-center">
            <p className="font-medium">Nobody is on this day yet</p>
            <p className="mt-1 text-[14px] text-[var(--text-muted)]">Add the people working, then use Autofill.</p>
            <button
              type="button"
              className="btn btn-primary mt-4"
              onClick={(e) => {
                e.stopPropagation();
                setEmployeePickerOpen(true);
              }}
            >
              Add person
            </button>
          </div>
        )}
      </div>

      <SchoolTourList
        tours={schoolTours}
        onRemove={(id) => setSchoolToursState(schoolToursRef.current.filter((tour) => tour.id !== id))}
        onClear={() => setSchoolToursState([])}
      />

      <TaskPickerDialog
        open={!!taskPickerSlot}
        slotLabel={
          taskPickerSlot
            ? `${employeeCols.find((column) => column.col === taskPickerSlot.col)?.name ?? ""} at ${timeForRow(taskPickerSlot.row)}`
            : ""
        }
        templates={templates}
        onClose={() => setTaskPickerSlot(null)}
        onPick={createTaskFromTemplate}
      />
      <EmployeePickerDialog
        open={employeePickerOpen}
        people={people}
        employees={employees}
        onAdd={addEmployee}
        onRemove={removeEmployeeFromPicker}
        onClose={() => setEmployeePickerOpen(false)}
      />
    </div>
  );
});

export default Grid;
