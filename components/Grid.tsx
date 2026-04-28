"use client";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { X, Trash2, Search, Settings2, Upload, CalendarDays, Clock3, Users } from "lucide-react";
import Block from "@/components/Block";
import Modal from "@/components/Modal";
import { AutosaveState, readDraftRecord, writeDraftRecord } from "@/lib/clientDrafts";
import { buildEditorDraftStorageKey } from "@/lib/editorPersistence";
import {
  TASK_TEMPLATE_REFRESH_EVENT,
  TASK_TEMPLATE_REFRESH_STORAGE_KEY,
  TaskTemplate,
} from "@/lib/taskTemplates";
import { getDayScheduleForDate, type Person } from "@/lib/people";
import { parseSchoolTourWorkbook, type ImportedSchoolTour } from "@/lib/schoolTourImports";

type Employee = { id: string | number; name: string; startTime?: string; endTime?: string };
type GridTask = {
  id: string | number;
  type: string;
  label: string;
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
type SchoolTourEntry = {
  id: string;
  rosterDateId: string;
  startTime: string;
  schoolName: string;
  studentCount: number;
};
type HistorySnapshot = {
  employees: Employee[];
  tasks: GridTask[];
};

type RosterDraftValue = {
  employees: Employee[];
  tasks: GridTask[];
  schoolTours?: SchoolTourEntry[];
  hoursStart?: string;
  hoursEnd?: string;
};

export type RosterSaveState = AutosaveState;

const MIN_ROW = 2;
const DEFAULT_START_MIN = 9 * 60 + 30;
const DEFAULT_END_MIN = 16 * 60;
const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_HISTORY_ENTRIES = 100;
const SCHOOL_TOUR_RECORD_TYPE = "__school-tour-import";
function parseTimeToMinutes(value?: string) {
  if (!value) return null;
  const [hStr, mStr] = value.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function cloneEmployees(input: Employee[]) {
  return input.map((emp) => ({ ...emp }));
}

function cloneTasks(input: GridTask[]) {
  return input.map((task) => ({ ...task }));
}

function cloneSchoolTours(input: SchoolTourEntry[]) {
  return input.map((tour) => ({ ...tour }));
}

function areEmployeesEqual(a: Employee[], b: Employee[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].name !== b[i].name ||
      a[i].startTime !== b[i].startTime ||
      a[i].endTime !== b[i].endTime
    ) {
      return false;
    }
  }
  return true;
}

function areTasksEqual(a: GridTask[], b: GridTask[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.type !== y.type ||
      x.label !== y.label ||
      x.col !== y.col ||
      x.startRow !== y.startRow ||
      x.span !== y.span ||
      x.color !== y.color ||
      x.employeeId !== y.employeeId ||
      x.locked !== y.locked ||
      x.isLocked !== y.isLocked ||
      x.readOnly !== y.readOnly
    ) {
      return false;
    }
  }
  return true;
}

function areSchoolToursEqual(a: SchoolTourEntry[], b: SchoolTourEntry[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (
      a[i].id !== b[i].id ||
      a[i].rosterDateId !== b[i].rosterDateId ||
      a[i].startTime !== b[i].startTime ||
      a[i].schoolName !== b[i].schoolName ||
      a[i].studentCount !== b[i].studentCount
    ) {
      return false;
    }
  }
  return true;
}

function formatMinutesToTime(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isTaskLocked(task: GridTask) {
  return task.locked === true || task.isLocked === true || task.readOnly === true;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const editable = target.closest("input, textarea, select, [contenteditable], [role='textbox']");
  if (!editable) return false;
  if (editable instanceof HTMLInputElement) return true;
  if (editable instanceof HTMLTextAreaElement) return true;
  if (editable instanceof HTMLSelectElement) return true;
  if (editable instanceof HTMLElement && editable.isContentEditable) return true;
  return editable.getAttribute("role") === "textbox";
}

function encodeSchoolToursAsTasks(schoolTours: SchoolTourEntry[]) {
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

function splitGridTasksAndSchoolTours(input: any[]) {
  const gridTasks: GridTask[] = [];
  const schoolTours: SchoolTourEntry[] = [];

  input.forEach((task, index) => {
    if (String(task?.type) === SCHOOL_TOUR_RECORD_TYPE) {
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
      return;
    }
    gridTasks.push(task as GridTask);
  });

  schoolTours.sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    return a.schoolName.localeCompare(b.schoolName);
  });

  return { gridTasks, schoolTours };
}

function buildRosterSaveSignature(
  employeeList: Employee[],
  taskList: GridTask[],
  schoolTours: SchoolTourEntry[],
  hoursStart?: string,
  hoursEnd?: string,
  rosterDateId?: string
) {
  const persistedTasks = [...taskList, ...encodeSchoolToursAsTasks(schoolTours)];
  return JSON.stringify({
    rosterDateId,
    hoursStart: hoursStart || "",
    hoursEnd: hoursEnd || "",
    employees: employeeList.map((emp) => ({
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

export default function Grid({
  toolbar,
  employees: initialEmployees,
  initialTasks,
  rosterDateId,
  rosterDate,
  hoursStart,
  hoursEnd,
  initialSavedAt,
  onExportWorkbook,
  onSaveStateChange,
  onRestoreDraftHours,
  people: initialPeople,
  templates: initialTemplates,
}: {
  toolbar?: React.ReactNode;
  employees: Employee[];
  initialTasks: GridTask[];
  rosterDateId: string;
  rosterDate: Date;
  hoursStart?: string;
  hoursEnd?: string;
  initialSavedAt?: string;
  onExportWorkbook: (html: string, fileName: string) => void;
  onSaveStateChange?: (state: RosterSaveState) => void;
  onRestoreDraftHours?: (hours: { start: string; end: string }) => void;
  people?: Person[];
  templates?: TaskTemplate[];
}) {
  const initialSplitRecords = useMemo(
    () => splitGridTasksAndSchoolTours(initialTasks),
    [initialTasks]
  );
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [tasks, setTasks] = useState<GridTask[]>(initialSplitRecords.gridTasks);
  const [schoolTours, setSchoolTours] = useState<SchoolTourEntry[]>(initialSplitRecords.schoolTours);
  const [selected, setSelected] = useState<string | number | undefined>();
  const [employeeSettingsId, setEmployeeSettingsId] = useState<string | number | null>(null);
  const [employeeSettingsDraft, setEmployeeSettingsDraft] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [employeeSettingsDirty, setEmployeeSettingsDirty] = useState(false);
  const [employeeSettingsError, setEmployeeSettingsError] = useState("");
  const [drag, setDrag] = useState<null | { id: string | number; which: "top" | "bottom"; y0: number; start0: number; span0: number }>(null);
  const [modal, setModal] = useState<null | { col: number; row: number }>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [employeePickerQuery, setEmployeePickerQuery] = useState("");
  const [people, setPeople] = useState<Person[]>(initialPeople ?? []);
  const [templates, setTemplates] = useState<TaskTemplate[]>(initialTemplates ?? []);

  const containerRef = useRef<HTMLDivElement>(null);
  const employeeSettingsRef = useRef<HTMLDivElement>(null);
  const firstTimeCellRef = useRef<HTMLDivElement>(null);
  const prevStartRef = useRef<number | null>(null);
  const prevMaxRef = useRef<number | null>(null);
  const employeesRef = useRef<Employee[]>(initialEmployees);
  const tasksRef = useRef<GridTask[]>(initialSplitRecords.gridTasks);
  const schoolToursRef = useRef<SchoolTourEntry[]>(initialSplitRecords.schoolTours);
  const hoursRef = useRef<{ start?: string; end?: string }>({ start: hoursStart, end: hoursEnd });
  const historyPastRef = useRef<HistorySnapshot[]>([]);
  const historyFutureRef = useRef<HistorySnapshot[]>([]);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveModeRef = useRef<"autosave" | "manual" | null>(null);
  const saveCycleRef = useRef(0);
  const suspendDraftEffectsRef = useRef(true);
  const lastSavedAtRef = useRef(initialSavedAt);
  const lastSavedSignatureRef = useRef(
    buildRosterSaveSignature(
      initialEmployees,
      initialSplitRecords.gridTasks,
      initialSplitRecords.schoolTours,
      hoursStart,
      hoursEnd,
      rosterDateId
    )
  );
  const draftStorageKey = useMemo(() => buildEditorDraftStorageKey(rosterDateId), [rosterDateId]);

  const dayStartMin = useMemo(() => parseTimeToMinutes(hoursStart) ?? DEFAULT_START_MIN, [hoursStart]);
  const rawEndMin = useMemo(() => parseTimeToMinutes(hoursEnd) ?? DEFAULT_END_MIN, [hoursEnd]);
  const dayEndMin = Math.max(rawEndMin, dayStartMin + 60);
  const totalRows = Math.max(1, Math.floor((dayEndMin - dayStartMin) / 15));
  const maxRowEx = MIN_ROW + totalRows;

  const timeForRow = useCallback(
    (row: number) => {
      const mins = dayStartMin + (row - MIN_ROW) * 15;
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    },
    [dayStartMin]
  );
  const timeRangeForRow = useCallback(
    (row: number) => `${timeForRow(row)}-${timeForRow(row + 1)}`,
    [timeForRow]
  );
  const timeRangeForSpan = useCallback(
    (startRow: number, span: number) => `${timeForRow(startRow)}-${timeForRow(startRow + span)}`,
    [timeForRow]
  );
  const rowFromTime = useCallback(
    (value: string, mode: "floor" | "ceil" = "floor") => {
      const mins = parseTimeToMinutes(value);
      if (mins === null) return null;
      const offset = (mins - dayStartMin) / 15;
      const step = mode === "ceil" ? Math.ceil(offset) : Math.floor(offset);
      return MIN_ROW + step;
    },
    [dayStartMin]
  );

  const snapshotFrom = useCallback((employeeList: Employee[], taskList: GridTask[]): HistorySnapshot => {
    return {
      employees: cloneEmployees(employeeList),
      tasks: cloneTasks(taskList),
    };
  }, []);

  const pushHistorySnapshot = useCallback((employeeList: Employee[], taskList: GridTask[]) => {
    historyPastRef.current.push(snapshotFrom(employeeList, taskList));
    if (historyPastRef.current.length > MAX_HISTORY_ENTRIES) {
      historyPastRef.current.shift();
    }
    historyFutureRef.current = [];
  }, [snapshotFrom]);

  const setRosterState = useCallback((nextEmployees: Employee[], nextTasks: GridTask[]) => {
    employeesRef.current = nextEmployees;
    tasksRef.current = nextTasks;
    setEmployees(nextEmployees);
    setTasks(nextTasks);
  }, []);

  const applyRosterState = useCallback(
    (nextEmployees: Employee[], nextTasks: GridTask[], options?: { recordHistory?: boolean }) => {
      const prevEmployees = employeesRef.current;
      const prevTasks = tasksRef.current;
      const employeesChanged = !areEmployeesEqual(prevEmployees, nextEmployees);
      const tasksChanged = !areTasksEqual(prevTasks, nextTasks);
      if (!employeesChanged && !tasksChanged) return false;
      if (options?.recordHistory !== false) {
        pushHistorySnapshot(prevEmployees, prevTasks);
      }
      setRosterState(nextEmployees, nextTasks);
      return true;
    },
    [pushHistorySnapshot, setRosterState]
  );

  const undo = useCallback(() => {
    const past = historyPastRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current = snapshotFrom(employeesRef.current, tasksRef.current);
    historyPastRef.current = past.slice(0, -1);
    historyFutureRef.current.push(current);
    setRosterState(cloneEmployees(previous.employees), cloneTasks(previous.tasks));
    setSelected(undefined);
  }, [setRosterState, snapshotFrom]);

  const redo = useCallback(() => {
    const future = historyFutureRef.current;
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const current = snapshotFrom(employeesRef.current, tasksRef.current);
    historyFutureRef.current = future.slice(0, -1);
    historyPastRef.current.push(current);
    if (historyPastRef.current.length > MAX_HISTORY_ENTRIES) {
      historyPastRef.current.shift();
    }
    setRosterState(cloneEmployees(next.employees), cloneTasks(next.tasks));
    setSelected(undefined);
  }, [setRosterState, snapshotFrom]);

  useEffect(() => {
    suspendDraftEffectsRef.current = true;
    const serverDraftValue: RosterDraftValue = {
      employees: cloneEmployees(initialEmployees),
      tasks: cloneTasks(initialSplitRecords.gridTasks),
      schoolTours: cloneSchoolTours(initialSplitRecords.schoolTours),
      hoursStart,
      hoursEnd,
    };
    const serverSignature = buildRosterSaveSignature(
      serverDraftValue.employees,
      serverDraftValue.tasks,
      serverDraftValue.schoolTours ?? [],
      serverDraftValue.hoursStart,
      serverDraftValue.hoursEnd,
      rosterDateId
    );
    const persistedDraft = readDraftRecord<RosterDraftValue>(draftStorageKey);
    const persistedValue = persistedDraft?.value ?? serverDraftValue;
    const persistedSignature = buildRosterSaveSignature(
      persistedValue.employees,
      persistedValue.tasks,
      persistedValue.schoolTours ?? [],
      persistedValue.hoursStart,
      persistedValue.hoursEnd,
      rosterDateId
    );
    const nextLastSavedSignature = persistedDraft?.lastSavedSignature ?? serverSignature;
    const shouldUseDraft =
      persistedDraft !== null &&
      (persistedSignature !== serverSignature || nextLastSavedSignature !== serverSignature);
    const nextDraftValue = shouldUseDraft ? persistedValue : serverDraftValue;
    const nextSavedAt = persistedDraft?.savedAt ?? initialSavedAt;

    setRosterState(
      cloneEmployees(nextDraftValue.employees),
      cloneTasks(nextDraftValue.tasks)
    );
    const nextSchoolTours = cloneSchoolTours(nextDraftValue.schoolTours ?? []);
    schoolToursRef.current = nextSchoolTours;
    setSchoolTours(nextSchoolTours);
    historyPastRef.current = [];
    historyFutureRef.current = [];
    setSelected(undefined);
    setEmployeeSettingsId(null);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    lastSavedAtRef.current = nextSavedAt;
    lastSavedSignatureRef.current = shouldUseDraft ? nextLastSavedSignature : serverSignature;
    writeDraftRecord<RosterDraftValue>(draftStorageKey, {
      value: nextDraftValue,
      lastSavedSignature: lastSavedSignatureRef.current,
      savedAt: lastSavedAtRef.current,
    });
    if (shouldUseDraft && typeof onRestoreDraftHours === "function") {
      onRestoreDraftHours({
        start: nextDraftValue.hoursStart || hoursStart || "",
        end: nextDraftValue.hoursEnd || hoursEnd || "",
      });
    }
    saveCycleRef.current += 1;
    queuedSaveModeRef.current = null;
    onSaveStateChange?.(
      persistedSignature !== lastSavedSignatureRef.current
        ? { state: "dirty", mode: "autosave", savedAt: lastSavedAtRef.current }
        : lastSavedAtRef.current
          ? { state: "saved", savedAt: lastSavedAtRef.current }
          : { state: "idle" }
    );
    setEmployeeSettingsError("");
    queueMicrotask(() => {
      suspendDraftEffectsRef.current = false;
    });
  }, [
    draftStorageKey,
    initialEmployees,
    initialSavedAt,
    initialTasks,
    initialSplitRecords.gridTasks,
    initialSplitRecords.schoolTours,
    onRestoreDraftHours,
    onSaveStateChange,
    rosterDateId,
    setRosterState,
  ]);

  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    schoolToursRef.current = schoolTours;
  }, [schoolTours]);

  useEffect(() => {
    hoursRef.current = { start: hoursStart, end: hoursEnd };
  }, [hoursStart, hoursEnd]);

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
    if (selected === undefined) return;
    if (!tasks.some((task) => task.id === selected)) {
      setSelected(undefined);
    }
  }, [tasks, selected]);

  useEffect(() => {
    if (employeeSettingsId === null) return;
    const onOutsideClick = (e: MouseEvent) => {
      if (!employeeSettingsRef.current) return;
      if (employeeSettingsRef.current.contains(e.target as Node)) return;
      setEmployeeSettingsId(null);
      setEmployeeSettingsDirty(false);
      setEmployeeSettingsError("");
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [employeeSettingsId]);

  useEffect(() => {
    if (employeeSettingsId === null) return;
    if (!employees.some((emp) => emp.id === employeeSettingsId)) {
      setEmployeeSettingsId(null);
      setEmployeeSettingsDirty(false);
      setEmployeeSettingsError("");
    }
  }, [employeeSettingsId, employees]);

  useEffect(() => {
    if (prevStartRef.current === null) {
      prevStartRef.current = dayStartMin;
      prevMaxRef.current = maxRowEx;
      return;
    }
    const prevStart = prevStartRef.current;
    const prevMax = prevMaxRef.current ?? maxRowEx;
    const offset = Math.round((prevStart - dayStartMin) / 15);
    const needsClamp = prevMax !== maxRowEx;
    if (offset === 0 && !needsClamp) {
      prevStartRef.current = dayStartMin;
      prevMaxRef.current = maxRowEx;
      return;
    }
    setTasks((prev) => {
      const shifted = prev.map((t) => ({ ...t, startRow: t.startRow + offset }));
      const clamped = shifted
        .map((t) => {
          const start = clampNumber(t.startRow, MIN_ROW, maxRowEx - 1);
          const end = clampNumber(t.startRow + t.span, MIN_ROW + 1, maxRowEx);
          const span = Math.max(1, end - start);
          return { ...t, startRow: start, span };
        })
        .filter((t) => t.startRow < maxRowEx && t.startRow + t.span > MIN_ROW)
        .sort((a, b) => (a.col - b.col) || (a.startRow - b.startRow));
      return clamped;
    });
    prevStartRef.current = dayStartMin;
    prevMaxRef.current = maxRowEx;
  }, [dayStartMin, maxRowEx]);

  useEffect(() => {
    if (initialPeople !== undefined) {
      setPeople(initialPeople);
      return;
    }
    fetch("/api/people")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setPeople(Array.isArray(data) ? data : []))
      .catch(() => setPeople([]));
  }, [initialPeople]);

  const refreshTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/task-templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      if (initialTemplates === undefined) {
        setTemplates([]);
      }
    }
  }, [initialTemplates]);

  useEffect(() => {
    if (initialTemplates !== undefined) {
      setTemplates(initialTemplates);
    }

    void refreshTemplates();

    const handleTemplateRefresh = () => {
      void refreshTemplates();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === TASK_TEMPLATE_REFRESH_STORAGE_KEY) {
        void refreshTemplates();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshTemplates();
      }
    };

    window.addEventListener("focus", handleTemplateRefresh);
    window.addEventListener(TASK_TEMPLATE_REFRESH_EVENT, handleTemplateRefresh);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleTemplateRefresh);
      window.removeEventListener(TASK_TEMPLATE_REFRESH_EVENT, handleTemplateRefresh);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initialTemplates, refreshTemplates]);

  const templateById = useMemo(() => {
    const map = new Map<string, TaskTemplate>();
    templates.forEach((t) => map.set(t.id, t));
    return map;
  }, [templates]);

  const colorForType = useCallback((type: string) => templateById.get(type)?.color || "#e2e8f0", [templateById]);
  const colorForTask = useCallback(
    (task: Pick<GridTask, "type" | "color">) =>
      templateById.get(task.type)?.color || task.color || "#e2e8f0",
    [templateById]
  );

  const employeeCols = useMemo(
    () => employees.map((e, idx) => ({ id: e.id, name: e.name, startTime: e.startTime, endTime: e.endTime, col: idx + 2 })),
    [employees]
  );
  const peopleById = useMemo(() => new Map(people.map((p) => [String(p.id), p])), [people]);
  const peopleByName = useMemo(
    () => new Map(people.map((p) => [p.name.toLowerCase(), p])),
    [people]
  );
  const filteredPeople = useMemo(() => {
    const query = employeePickerQuery.trim().toLowerCase();
    const base = query
      ? people.filter((person) => {
          const nameMatch = person.name.toLowerCase().includes(query);
          const emailMatch = (person.email || "").toLowerCase().includes(query);
          return nameMatch || emailMatch;
        })
      : people;
    return [...base].sort((a, b) => a.name.localeCompare(b.name));
  }, [people, employeePickerQuery]);
  const selectedEmployeeIds = useMemo(
    () => new Set(employees.map((employee) => String(employee.id))),
    [employees]
  );
  const selectedEmployeeNames = useMemo(
    () => new Set(employees.map((employee) => employee.name.trim().toLowerCase())),
    [employees]
  );
  const displayCols = employeeCols;

  function resolveEmployeeHours(emp: Employee) {
    const overrideStart = parseTimeToMinutes(emp.startTime);
    const overrideEnd = parseTimeToMinutes(emp.endTime);
    if (overrideStart !== null && overrideEnd !== null && overrideStart < overrideEnd) {
      return { start: emp.startTime as string, end: emp.endTime as string, isOff: false, isOverride: true };
    }

    const person =
      peopleById.get(String(emp.id)) ||
      peopleByName.get(String(emp.name || "").toLowerCase());
    const sched = person ? getDayScheduleForDate(person, rosterDate) : null;
    if (sched?.enabled) {
      return { start: sched.start, end: sched.end, isOff: false, isOverride: false };
    }

    return {
      start: formatMinutesToTime(dayStartMin),
      end: formatMinutesToTime(dayEndMin),
      isOff: !!person && !!sched && !sched.enabled,
      isOverride: false,
    };
  }

  function getEmployeeHoursLabel(emp: Employee) {
    const resolved = resolveEmployeeHours(emp);
    if (resolved.isOff) return "Off";
    return `${resolved.start}-${resolved.end}`;
  }
  const rowHeight = () => firstTimeCellRef.current?.getBoundingClientRect().height ?? 44;

  function openEmployeeSettings(emp: Employee) {
    if (employeeSettingsId === emp.id) {
      setEmployeeSettingsId(null);
      setEmployeeSettingsDirty(false);
      setEmployeeSettingsError("");
      return;
    }
    const resolved = resolveEmployeeHours(emp);
    setEmployeeSettingsId(emp.id);
    setEmployeeSettingsDraft({ start: resolved.start, end: resolved.end });
    setEmployeeSettingsDirty(false);
    setEmployeeSettingsError("");
  }

  useEffect(() => {
    if (employeeSettingsId === null || !employeeSettingsDirty) return;
    const start = employeeSettingsDraft.start;
    const end = employeeSettingsDraft.end;
    const startMin = parseTimeToMinutes(start);
    const endMin = parseTimeToMinutes(end);
    if (startMin === null || endMin === null || startMin >= endMin) {
      setEmployeeSettingsError("Enter a valid start/end time.");
      return;
    }
    const current = employeesRef.current.find((emp) => emp.id === employeeSettingsId);
    if (current && current.startTime === start && current.endTime === end) {
      setEmployeeSettingsDirty(false);
      setEmployeeSettingsError("");
      return;
    }
    const nextEmployees = employeesRef.current.map((emp) =>
      emp.id === employeeSettingsId ? { ...emp, startTime: start, endTime: end } : emp
    );
    applyRosterState(nextEmployees, tasksRef.current);
    setEmployeeSettingsDirty(false);
    setEmployeeSettingsError("");
  }, [employeeSettingsId, employeeSettingsDirty, employeeSettingsDraft.start, employeeSettingsDraft.end, applyRosterState]);

  const clearEmployeeSettingsOverride = useCallback(() => {
    if (employeeSettingsId === null) return;
    const nextEmployees = employeesRef.current.map((emp) =>
      emp.id === employeeSettingsId ? { ...emp, startTime: undefined, endTime: undefined } : emp
    );
    applyRosterState(nextEmployees, tasksRef.current);
    setEmployeeSettingsId(null);
    setEmployeeSettingsDirty(false);
    setEmployeeSettingsError("");
  }, [employeeSettingsId, applyRosterState]);

  function blocksInCol(col: number) {
    return tasks.filter(t => t.col === col).sort((a, b) => a.startRow - b.startRow);
  }
  const openAddEmployeePicker = useCallback(() => {
    setAddOpen(true);
  }, []);

  const addEmployee = useCallback((person: Person) => {
    const prevEmployees = employeesRef.current;
    const exists = prevEmployees.some((e) => String(e.id) === person.id || e.name === person.name);
    if (exists) return;
    const nextId = Math.max(0, ...prevEmployees.map((e) => Number(e.id) || 0)) + 1;
    const nextEmployees = [...prevEmployees, { id: person.id || String(nextId), name: person.name }];
    applyRosterState(nextEmployees, tasksRef.current);
  }, [applyRosterState]);

  const editEmployee = useCallback((id: number) => {
    const prevEmployees = employeesRef.current;
    const emp = prevEmployees.find((e) => e.id === id);
    if (!emp) return;
    const name = prompt("Edit employee name", emp.name);
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const nextEmployees = prevEmployees.map((e) => (e.id === id ? { ...e, name: trimmed } : e));
    applyRosterState(nextEmployees, tasksRef.current);
  }, [applyRosterState]);

  const resetRoster = useCallback(() => {
    const working = people.filter((p) => getDayScheduleForDate(p, rosterDate).enabled);
    const nextEmps = (working.length ? working : []).map((p) => ({ id: p.id, name: p.name }));
    applyRosterState(nextEmps.length ? nextEmps : initialEmployees, []);
    setSelected(undefined);
  }, [people, rosterDate, initialEmployees, applyRosterState]);

  const removeSchoolTour = useCallback((id: string) => {
    const nextSchoolTours = schoolToursRef.current.filter((tour) => tour.id !== id);
    schoolToursRef.current = nextSchoolTours;
    setSchoolTours(nextSchoolTours);
  }, []);

  const clearSchoolTours = useCallback(() => {
    schoolToursRef.current = [];
    setSchoolTours([]);
  }, []);

  const removeEmployee = useCallback((id: string | number, options?: { skipConfirm?: boolean }) => {
    const prevEmployees = employeesRef.current;
    const idx = prevEmployees.findIndex((e) => e.id === id);
    if (idx === -1) return;
    if (!options?.skipConfirm && !confirm("Remove this employee from the roster?")) return;
    const colToRemove = idx + 2;
    const nextEmployees = prevEmployees.filter((e) => e.id !== id);
    const nextTasks = tasksRef.current
      .filter((t) => t.col !== colToRemove)
      .map((t) => (t.col > colToRemove ? { ...t, col: t.col - 1 } : t));
    applyRosterState(nextEmployees, nextTasks);
    if (employeeSettingsId === id) {
      setEmployeeSettingsId(null);
      setEmployeeSettingsDirty(false);
      setEmployeeSettingsError("");
    }
  }, [applyRosterState, employeeSettingsId]);

  const removeEmployeeFromPicker = useCallback((person: Person) => {
    const target = employeesRef.current.find(
      (employee) =>
        String(employee.id) === String(person.id) ||
        employee.name.trim().toLowerCase() === person.name.trim().toLowerCase()
    );
    if (!target) return;
    removeEmployee(target.id, { skipConfirm: true });
  }, [removeEmployee]);

  const importSchoolTours = useCallback(
    async (file: File) => {
      const importedRows = parseSchoolTourWorkbook(await file.arrayBuffer());
      if (importedRows.length === 0) {
        throw new Error("No school tour rows were found in the workbook.");
      }

      const matchingRows: ImportedSchoolTour[] = importedRows.filter((row) => row.rosterDateId === rosterDateId);
      if (matchingRows.length === 0) {
        const foundDates = Array.from(new Set(importedRows.map((row) => row.rosterDateId))).join(", ");
        throw new Error(`This workbook contains ${foundDates}, not ${rosterDateId}.`);
      }

      const nextSchoolToursByKey = new Map(
        schoolToursRef.current.map((tour) => [
          `${tour.rosterDateId}|${tour.startTime}|${tour.schoolName.toLowerCase()}|${tour.studentCount}`,
          tour,
        ])
      );
      matchingRows.forEach((row) => {
        const key = `${row.rosterDateId}|${row.startTime}|${row.schoolName.toLowerCase()}|${row.studentCount}`;
        if (!nextSchoolToursByKey.has(key)) {
          nextSchoolToursByKey.set(key, {
            id: crypto.randomUUID?.() ?? String(Math.random()),
            rosterDateId: row.rosterDateId,
            startTime: row.startTime,
            schoolName: row.schoolName,
            studentCount: row.studentCount,
          });
        }
      });
      const nextSchoolTours = Array.from(nextSchoolToursByKey.values()).sort((a, b) => {
        if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
        return a.schoolName.localeCompare(b.schoolName);
      });
      schoolToursRef.current = nextSchoolTours;
      setSchoolTours(nextSchoolTours);
      window.alert(`Imported ${matchingRows.length} school tours into the day panel.`);
    },
    [rosterDateId]
  );

  /* Autofill removed for rebuild.
    const autofillVariant = autofillRunRef.current;
    autofillRunRef.current += 1;
    if (!employees.length) {
      applyRosterState(employees, []);
      return;
    }

    type TemplateMeta = {
      id: string;
      template: TaskTemplate;
      span: number;
      minSpan: number;
      waitingMinutes: number;
      packingMinutes: number;
      window: { startRow: number; endRow: number } | null;
      regularTimeRows: number[];
      hasFixedTimes: boolean;
      limitPerDay: number;
      maxPerEmp: number;
      minPerEmp: number;
      mustManned: boolean;
      overwriteExistingTasks: boolean;
      attendedByAll: boolean;
      allowShrink: boolean;
      maxConsecutiveSpan: number;
      maxConcurrentPerTimeslot: number;
      fixedTimeBlock: boolean;
      protectsTourWindow: boolean;
    };

    type CoverageAvailability = {
      blockedRows: number;
      tightestCoverage: number;
      totalOptions: number;
    };

    type PlacementCandidate = {
      meta: TemplateMeta;
      emp: Employee;
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

    const dayKey = DAY_KEYS[rosterDate.getDay()];
    const generated: GridTask[] = [];
    const tasksByCol = new Map<number, GridTask[]>();
    const countsByTemplate = new Map<string, Map<string | number, number>>();
    const totalsByTemplate = new Map<string, number>();
    const employeeColById = new Map(employees.map((e, idx) => [e.id, idx + 2]));
    const peopleById = new Map(people.map((p) => [String(p.id), p]));
    const peopleByName = new Map(people.map((p) => [p.name.toLowerCase(), p]));
    const employeeWindows = new Map<string | number, { startRow: number; endRow: number } | null>();
    const employeeOrder = new Map(employees.map((emp, index) => [emp.id, index]));

    const getRotatedRank = (index: number, total: number, offset: number) => {
      if (total <= 0) return 0;
      const normalizedOffset = ((offset % total) + total) % total;
      return (index - normalizedOffset + total) % total;
    };

    const getSegmentRows = (task: { span: number; waitingMinutes?: number; packingMinutes?: number }) => {
      const totalRows = Math.max(1, task.span);
      const waitingRows = Math.max(0, Math.round((task.waitingMinutes ?? 0) / 15));
      const packingRows = Math.max(0, Math.round((task.packingMinutes ?? 0) / 15));
      const safeWaiting = Math.min(waitingRows, totalRows - 1);
      const safePacking = Math.min(packingRows, totalRows - safeWaiting - 1);
      const mainRows = Math.max(1, totalRows - safeWaiting - safePacking);
      return { waitingRows: safeWaiting, mainRows, packingRows: safePacking };
    };

    const getRowVariantRank = (rows: number[], row: number, offset: number) => {
      const index = rows.indexOf(row);
      return getRotatedRank(index < 0 ? 0 : index, rows.length, offset);
    };

    const getTotal = (templateId: string) => totalsByTemplate.get(templateId) ?? 0;
    const incTotal = (templateId: string) => totalsByTemplate.set(templateId, getTotal(templateId) + 1);
    const decTotal = (templateId: string) => totalsByTemplate.set(templateId, Math.max(0, getTotal(templateId) - 1));

    const getEmpCount = (templateId: string, empId: string | number) =>
      countsByTemplate.get(templateId)?.get(empId) ?? 0;
    const incEmpCount = (templateId: string, empId: string | number) => {
      if (!countsByTemplate.has(templateId)) countsByTemplate.set(templateId, new Map());
      const map = countsByTemplate.get(templateId)!;
      map.set(empId, (map.get(empId) ?? 0) + 1);
    };
    const decEmpCount = (templateId: string, empId: string | number) => {
      const map = countsByTemplate.get(templateId);
      if (!map) return;
      map.set(empId, Math.max(0, (map.get(empId) ?? 0) - 1));
    };

    const getEmployeeWindow = (emp: Employee) => {
      const cached = employeeWindows.get(emp.id);
      if (cached !== undefined) return cached;

      const overrideStart = parseTimeToMinutes(emp.startTime);
      const overrideEnd = parseTimeToMinutes(emp.endTime);
      if (overrideStart !== null && overrideEnd !== null && overrideStart < overrideEnd) {
        const startRaw = rowFromTime(emp.startTime as string, "ceil");
        const endRaw = rowFromTime(emp.endTime as string, "floor");
        if (startRaw !== null && endRaw !== null) {
          const startRow = clampNumber(startRaw, MIN_ROW, maxRowEx - 1);
          const endRow = clampNumber(endRaw, MIN_ROW + 1, maxRowEx);
          if (endRow > startRow) {
            const window = { startRow, endRow };
            employeeWindows.set(emp.id, window);
            return window;
          }
        }
      }

      const person =
        peopleById.get(String(emp.id)) ||
        peopleByName.get(String(emp.name || "").toLowerCase());
      const sched = person ? getDayScheduleForDate(person, rosterDate) : null;
      if (!sched?.enabled) {
        if (person) {
          employeeWindows.set(emp.id, null);
          return null;
        }
        const fallback = { startRow: MIN_ROW, endRow: maxRowEx };
        employeeWindows.set(emp.id, fallback);
        return fallback;
      }
      const startRaw = rowFromTime(sched.start, "ceil");
      const endRaw = rowFromTime(sched.end, "floor");
      if (startRaw === null || endRaw === null) {
        if (!person) {
          const fallback = { startRow: MIN_ROW, endRow: maxRowEx };
          employeeWindows.set(emp.id, fallback);
          return fallback;
        }
        employeeWindows.set(emp.id, null);
        return null;
      }
      const startRow = clampNumber(startRaw, MIN_ROW, maxRowEx - 1);
      const endRow = clampNumber(endRaw, MIN_ROW + 1, maxRowEx);
      if (endRow <= startRow) {
        employeeWindows.set(emp.id, null);
        return null;
      }
      const window = { startRow, endRow };
      employeeWindows.set(emp.id, window);
      return window;
    };

    const isFree = (col: number, startRow: number, span: number, empId?: string | number) => {
      if (empId !== undefined) {
        const emp = employees.find((e) => e.id === empId);
        const window = emp ? getEmployeeWindow(emp) : { startRow: MIN_ROW, endRow: maxRowEx };
        if (!window) return false;
        if (startRow < window.startRow || startRow + span > window.endRow) return false;
      }
      const end = startRow + span;
      const list = tasksByCol.get(col) ?? [];
      return !list.some((t) => end > t.startRow && startRow < t.startRow + t.span);
    };

    const exceedsConcurrentLimit = (
      templateId: string,
      startRow: number,
      span: number,
      maxConcurrentPerTimeslot: number
    ) => {
      if (!Number.isFinite(maxConcurrentPerTimeslot)) return false;
      const endRow = startRow + span;
      for (let row = startRow; row < endRow; row += 1) {
        let active = 0;
        for (const task of generated) {
          if (task.type !== templateId) continue;
          if (row < task.startRow + task.span && row + 1 > task.startRow) {
            active += 1;
            if (active >= maxConcurrentPerTimeslot) return true;
          }
        }
      }
      return false;
    };

    const sortTasks = (list: GridTask[]) =>
      list.sort((a, b) => (a.col - b.col) || (a.startRow - b.startRow) || String(a.id).localeCompare(String(b.id)));

    const addTask = (
      meta: TemplateMeta,
      col: number,
      startRow: number,
      span: number,
      empId: string | number,
      overrides?: { waitingMinutes?: number; packingMinutes?: number; label?: string; type?: string; color?: string }
    ) => {
      const id = crypto.randomUUID?.() ?? String(Math.random());
      const label = overrides?.label || meta.template.name || "Task";
      const type = overrides?.type || meta.template.id || label;
      const task: GridTask = {
        id,
        type,
        label,
        col,
        startRow,
        span,
        color: overrides?.color || meta.template.color || colorForType(type),
        waitingMinutes: overrides?.waitingMinutes ?? meta.waitingMinutes,
        packingMinutes: overrides?.packingMinutes ?? meta.packingMinutes,
        employeeId: empId,
      };
      generated.push(task);
      if (!tasksByCol.has(col)) tasksByCol.set(col, []);
      tasksByCol.get(col)!.push(task);
      sortTasks(tasksByCol.get(col)!);
      sortTasks(generated);
      incEmpCount(meta.id, empId);
      incTotal(meta.id);
      return task;
    };

    const removeTask = (task: GridTask, meta: TemplateMeta, empId: string | number) => {
      const generatedIndex = generated.findIndex((entry) => entry.id === task.id);
      if (generatedIndex >= 0) generated.splice(generatedIndex, 1);
      const list = tasksByCol.get(task.col);
      if (list) {
        const colIndex = list.findIndex((entry) => entry.id === task.id);
        if (colIndex >= 0) list.splice(colIndex, 1);
      }
      decEmpCount(meta.id, empId);
      decTotal(meta.id);
    };

    const replaceTasksInColumn = (col: number, nextTasks: GridTask[]) => {
      const currentIds = new Set((tasksByCol.get(col) ?? []).map((task) => task.id));
      for (let index = generated.length - 1; index >= 0; index -= 1) {
        if (currentIds.has(generated[index].id)) {
          generated.splice(index, 1);
        }
      }
      const sorted = sortTasks(nextTasks);
      tasksByCol.set(col, sorted);
      generated.push(...sorted);
      sortTasks(generated);
    };

    const clipConflictsInColumn = (col: number, startRow: number, span: number) => {
      const blockedRange = { startRow, span };
      const existing = tasksByCol.get(col) ?? [];
      const nextTasks: GridTask[] = [];

      for (const task of existing) {
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
            id: index === 0 ? task.id : (crypto.randomUUID?.() ?? String(Math.random())),
            startRow: fragment.startRow,
            span: fragment.span,
            waitingMinutes: fragment.waitingMinutes ?? 0,
            packingMinutes: fragment.packingMinutes ?? 0,
          });
        });
      }

      replaceTasksInColumn(col, nextTasks);
    };

    const getProtectedRangeForMeta = (meta: TemplateMeta, startRow: number, span: number) => {
      if (!meta.protectsTourWindow) return { startRow, span };
      const { waitingRows, mainRows } = getSegmentRows({
        span,
        waitingMinutes: meta.waitingMinutes,
        packingMinutes: meta.packingMinutes,
      });
      return {
        startRow: startRow + waitingRows,
        span: mainRows,
      };
    };

    const getSupportRangesForProtectedMeta = (meta: TemplateMeta, startRow: number, span: number) => {
      if (!meta.protectsTourWindow) return [];
      const { waitingRows, mainRows, packingRows } = getSegmentRows({
        span,
        waitingMinutes: meta.waitingMinutes,
        packingMinutes: meta.packingMinutes,
      });
      const ranges: Array<{ startRow: number; span: number }> = [];
      if (waitingRows > 0) ranges.push({ startRow, span: waitingRows });
      if (packingRows > 0) ranges.push({ startRow: startRow + waitingRows + mainRows, span: packingRows });
      return ranges;
    };

    const isColumnRangeFree = (col: number, range: { startRow: number; span: number }) => {
      const endRow = range.startRow + range.span;
      return !(tasksByCol.get(col) ?? []).some(
        (task) => endRow > task.startRow && range.startRow < task.startRow + task.span
      );
    };

    const getProtectedRangeForTask = (task: GridTask) => {
      const template = templateById.get(task.type);
      if (!template || !template.mustManned || !template.overwriteExistingTasks) return null;
      const { waitingRows, mainRows } = getSegmentRows({
        span: task.span,
        waitingMinutes: task.waitingMinutes ?? template.waitingMinutes,
        packingMinutes: task.packingMinutes ?? template.packingMinutes,
      });
      return {
        startRow: task.startRow + waitingRows,
        span: mainRows,
      };
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

    const rangesOverlap = (
      a: { startRow: number; span: number },
      b: { startRow: number; span: number }
    ) => a.startRow < b.startRow + b.span && a.startRow + a.span > b.startRow;

    const getProtectedTaskConflictInColumn = (col: number, blockedRange: { startRow: number; span: number }) => {
      const task = (tasksByCol.get(col) ?? []).find((entry) => {
        const protectedRange = getProtectedRangeForTask(entry);
        return protectedRange ? rangesOverlap(blockedRange, protectedRange) : false;
      });
      return task ? `${task.label} ${timeRangeForSpan(task.startRow, task.span)}` : null;
    };

    const hasProtectedMinimumConflictInColumn = (col: number, blockedRange: { startRow: number; span: number }) =>
      (tasksByCol.get(col) ?? []).some((task) => {
        if (!isProtectedMinimumTask(task)) return false;
        return rangesOverlap(blockedRange, { startRow: task.startRow, span: task.span });
      });

    const getProtectedAdjacencyScore = (col: number, startRow: number, span: number) => {
      const endRow = startRow + span;
      const protectedTasks = (tasksByCol.get(col) ?? [])
        .map((task) => ({ task, protectedRange: getProtectedRangeForTask(task) }))
        .filter((entry): entry is { task: GridTask; protectedRange: { startRow: number; span: number } } => !!entry.protectedRange);

      let score = 0;
      for (const { protectedRange } of protectedTasks) {
        const protectedEnd = protectedRange.startRow + protectedRange.span;
        if (protectedEnd === startRow || protectedRange.startRow === endRow) score += 1000;
        const gap = protectedEnd <= startRow
          ? startRow - protectedEnd
          : protectedRange.startRow >= endRow
            ? protectedRange.startRow - endRow
            : 0;
        score += Math.max(0, 8 - gap);
      }
      return score;
    };

    const overlapsProtectedTaskInColumn = (col: number, blockedRange: { startRow: number; span: number }) =>
      (tasksByCol.get(col) ?? []).some((task) => {
        const protectedRange = getProtectedRangeForTask(task);
        if (!protectedRange) return false;
        return rangesOverlap(blockedRange, protectedRange);
      });

    const getSpanForMeta = (
      meta: TemplateMeta,
      row: number,
      endRow: number,
      options: { ignoreWindow: boolean }
    ) => {
      const windowEnd = options.ignoreWindow ? endRow : (meta.window?.endRow ?? endRow);
      const maxEnd = Math.min(endRow, windowEnd, maxRowEx);
      const available = maxEnd - row;
      return resolveAutofillPlacementSpan({
        baseSpan: meta.span,
        availableSpan: available,
        allowShrink: meta.allowShrink,
        minSpan: meta.minSpan,
        maxConsecutiveSpan: meta.maxConsecutiveSpan,
      });
    };

    const getConsecutiveSpan = (col: number, type: string, startRow: number, span: number) => {
      const list = tasksByCol.get(col) ?? [];
      let total = span;
      let cursorStart = startRow;
      while (true) {
        const prev = list.find((t) => t.type === type && t.startRow + t.span === cursorStart);
        if (!prev) break;
        total += prev.span;
        cursorStart = prev.startRow;
      }
      let cursorEnd = startRow + span;
      while (true) {
        const next = list.find((t) => t.type === type && t.startRow === cursorEnd);
        if (!next) break;
        total += next.span;
        cursorEnd = next.startRow + next.span;
      }
      return total;
    };

    const exceedsConsecutiveLimit = (meta: TemplateMeta, col: number, startRow: number, span: number) =>
      meta.maxConsecutiveSpan > 0 && getConsecutiveSpan(col, meta.id, startRow, span) > meta.maxConsecutiveSpan;

    const isTypeCoveredAt = (templateId: string, row: number) =>
      generated.some((task) => task.type === templateId && row >= task.startRow && row < task.startRow + task.span);

    const countConcurrentAssignments = (templateId: string, startRow: number, span: number) => {
      const endRow = startRow + span;
      let busiestRow = 0;
      for (let row = startRow; row < endRow; row += 1) {
        let active = 0;
        for (const task of generated) {
          if (task.type !== templateId) continue;
          if (row < task.startRow + task.span && row + 1 > task.startRow) {
            active += 1;
          }
        }
        busiestRow = Math.max(busiestRow, active);
      }
      return busiestRow;
    };

    const getWindow = (template: TaskTemplate) => {
      const dayWindow = template.regularDayWindows?.[dayKey];
      const startValue = dayWindow?.start || template.autogenStart || "";
      const endValue = dayWindow?.end || template.autogenEnd || "";
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
    };

    const templateApplies = (template: TaskTemplate) => {
      return regularDayAppliesToAutofill({
        dayKey,
        regularDays: template.regularDays,
        regularTimes: template.regularTimes,
        regularTimesByDay: template.regularTimesByDay,
      });
    };

    const buildMeta = (template: TaskTemplate): TemplateMeta | null => {
      const window = getWindow(template);
      if (!window) return null;
      const hasDuration = Number.isFinite(template.durationMinutes) && (template.durationMinutes ?? 0) > 0;
      const baseDuration = hasDuration ? (template.durationMinutes as number) : 60;
      const waitingMinutes = template.waitingMinutes || 0;
      const packingMinutes = template.packingMinutes || 0;
      const totalMinutes = Math.max(
        15,
        baseDuration + waitingMinutes + packingMinutes
      );
      let span = Math.max(1, Math.ceil(totalMinutes / 15));
      const waitingRows = Math.max(0, Math.round(waitingMinutes / 15));
      const packingRows = Math.max(0, Math.round(packingMinutes / 15));
      const allowShrink = !hasDuration && waitingMinutes === 0 && packingMinutes === 0;
      const minSpanForSegments = Math.max(1, waitingRows + packingRows + 1);
      if (span < minSpanForSegments) span = minSpanForSegments;
      const maxConsecutiveMinutes = Number.isFinite(template.maxConsecutiveMinutes)
        ? Number(template.maxConsecutiveMinutes)
        : 0;
      const maxConsecutiveSpan = maxConsecutiveMinutes > 0
        ? Math.max(1, Math.ceil(maxConsecutiveMinutes / 15))
        : 0;
      const limitPerDay = template.limitPerDay && template.limitPerDay > 0 ? template.limitPerDay : Number.POSITIVE_INFINITY;
      const maxConcurrentPerTimeslot =
        template.maxConcurrentPerTimeslot && template.maxConcurrentPerTimeslot > 0
          ? template.maxConcurrentPerTimeslot
          : Number.POSITIVE_INFINITY;
      const maxPerEmp = template.maxPerEmployeePerDay && template.maxPerEmployeePerDay > 0
        ? template.maxPerEmployeePerDay
        : Number.POSITIVE_INFINITY;
      const minPerEmp = template.minPerEmployeePerDay && template.minPerEmployeePerDay > 0
        ? template.minPerEmployeePerDay
        : 0;
      const regularTimesByDay =
        template.regularTimesByDay && typeof template.regularTimesByDay === "object" && !Array.isArray(template.regularTimesByDay)
          ? template.regularTimesByDay
          : {};
      const timeSlotConfig = resolveAutofillTimeSlots({
        dayKey,
        regularTimes: Array.isArray(template.regularTimes) ? template.regularTimes : [],
        regularTimesByDay,
      });
      const regularTimeRows = timeSlotConfig.regularTimes
        .map((t) => {
          const mainRow = rowFromTime(t, "floor");
          if (mainRow === null) return null;
          return mainRow - waitingRows;
        })
        .filter((r): r is number => r !== null)
        .filter((r) => r >= window.startRow && r + span <= window.endRow);
      const hasBoundedWindow = window.startRow > MIN_ROW || window.endRow < maxRowEx;
      const windowRows = window.endRow - window.startRow;
      const fixedTimeBlock =
        regularTimeRows.length > 0 ||
        (
          hasBoundedWindow &&
          minPerEmp === 0 &&
          !allowShrink &&
          (
            windowRows <= span ||
            !!template.mustManned ||
            !!template.attendedByAll ||
            !!template.overwriteExistingTasks
          )
        );
      return {
        id: template.id || template.name || "task",
        template,
        span,
        minSpan: minSpanForSegments,
        waitingMinutes,
        packingMinutes,
        window,
        regularTimeRows: Array.from(new Set(regularTimeRows)).sort((a, b) => a - b),
        hasFixedTimes: timeSlotConfig.hasAnyFixedTimes,
        limitPerDay,
        maxPerEmp,
        minPerEmp,
        mustManned: !!template.mustManned,
        overwriteExistingTasks: !!template.overwriteExistingTasks,
        attendedByAll: !!template.attendedByAll,
        allowShrink,
        maxConsecutiveSpan,
        maxConcurrentPerTimeslot,
        fixedTimeBlock,
        protectsTourWindow: !!template.mustManned && !!template.overwriteExistingTasks,
      };
    };

    const isMinimumMeta = (meta: TemplateMeta) =>
      isAutofillMinimumTemplate({
        mustManned: meta.mustManned,
        minPerEmp: meta.minPerEmp,
        attendedByAll: meta.attendedByAll,
        overwriteExistingTasks: meta.overwriteExistingTasks,
      });

    const getCandidateRowsForMeta = (meta: TemplateMeta) => {
      if (!meta.window) return [];
      if (meta.regularTimeRows.length > 0) return meta.regularTimeRows;
      if (meta.hasFixedTimes) return [];

      const rows: number[] = [];
      for (let row = meta.window.startRow; row < meta.window.endRow; row += 1) {
        if (getSpanForMeta(meta, row, meta.window.endRow, { ignoreWindow: false })) {
          rows.push(row);
        }
      }
      return rows;
    };

    const importedSchoolTourFailures: string[] = [];
    const schoolTourTemplate =
      templates.find((template) => template.schoolTourImportTarget) || null;
    const schoolTourMeta = schoolTourTemplate ? buildMeta(schoolTourTemplate) : null;

    const placeImportedSchoolTours = () => {
      if (!schoolTourMeta) {
        if (schoolTours.length) {
          importedSchoolTourFailures.push("no task is marked as the imported school tours target");
        }
        return;
      }
      const sortedSchoolTours = [...schoolTours].sort((a, b) => {
        if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
        return a.schoolName.localeCompare(b.schoolName);
      });

      for (const schoolTour of sortedSchoolTours) {
        const mainStartRow = rowFromTime(schoolTour.startTime, "floor");
        if (mainStartRow === null) {
          importedSchoolTourFailures.push(`${schoolTour.schoolName} (${schoolTour.studentCount})`);
          continue;
        }

        const startRow = mainStartRow - Math.max(0, Math.round((schoolTourMeta.waitingMinutes || 0) / 15));
        const span = schoolTourMeta.span;
        if (!span || startRow < MIN_ROW || startRow + span > maxRowEx) {
          importedSchoolTourFailures.push(`${schoolTour.schoolName} (${schoolTour.studentCount})`);
          continue;
        }
        const protectedRange = getProtectedRangeForMeta(schoolTourMeta, startRow, span);

        const eligibleEmployees = [...employees]
          .filter((emp) => {
            const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
            const protectedConflict = schoolTourMeta.protectsTourWindow
              ? getProtectedTaskConflictInColumn(col, protectedRange)
              : null;
            return (
              !protectedConflict &&
              getEmpCount(schoolTourMeta.id, emp.id) < schoolTourMeta.maxPerEmp &&
              isFree(col, startRow, span, emp.id) &&
              !exceedsConcurrentLimit(schoolTourMeta.id, startRow, span, schoolTourMeta.maxConcurrentPerTimeslot) &&
              !exceedsConsecutiveLimit(schoolTourMeta, col, startRow, span)
            );
          })
          .sort((a, b) => {
            const colA = employeeColById.get(a.id) ?? employees.findIndex((entry) => entry.id === a.id) + 2;
            const colB = employeeColById.get(b.id) ?? employees.findIndex((entry) => entry.id === b.id) + 2;
            const adjacencyDiff =
              getProtectedAdjacencyScore(colA, startRow, span) -
              getProtectedAdjacencyScore(colB, startRow, span);
            if (adjacencyDiff !== 0) return adjacencyDiff;
            const countDiff = getEmpCount(schoolTourMeta.id, a.id) - getEmpCount(schoolTourMeta.id, b.id);
            if (countDiff !== 0) return countDiff;
            return (
              getRotatedRank(employeeOrder.get(a.id) ?? 0, employees.length, autofillVariant) -
              getRotatedRank(employeeOrder.get(b.id) ?? 0, employees.length, autofillVariant)
            );
          });

        const picked = eligibleEmployees[0];
        if (!picked) {
          importedSchoolTourFailures.push(`${schoolTour.schoolName} (${schoolTour.studentCount})`);
          continue;
        }

        const col = employeeColById.get(picked.id) ?? employees.findIndex((entry) => entry.id === picked.id) + 2;
        addTask(schoolTourMeta, col, startRow, span, picked.id, {
          label: `${schoolTour.schoolName} (${schoolTour.studentCount})`,
          type: schoolTourMeta.id,
          color: schoolTourMeta.template.color || colorForType(schoolTourMeta.id),
        });
      }
    };

    const getFutureMinimumAvailabilityCounts = (
      emp: Employee,
      blockedRange: { startRow: number; span: number } | null,
      futureMinimumMetas: TemplateMeta[]
    ) => {
      if (!futureMinimumMetas.length) return [];

      const col = employeeColById.get(emp.id) ?? employees.findIndex((e) => e.id === emp.id) + 2;
      const employeeWindow = getEmployeeWindow(emp);
      if (!employeeWindow) return futureMinimumMetas.map(() => 0);

      const occupiedRanges = (tasksByCol.get(col) ?? []).map((task) => ({
        startRow: task.startRow,
        span: task.span,
      }));

      return futureMinimumMetas.map((futureMeta) => {
        if (getEmpCount(futureMeta.id, emp.id) >= futureMeta.minPerEmp) return Number.POSITIVE_INFINITY;
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

    const pickPlacementForRow = (
      meta: TemplateMeta,
      row: number,
      span: number,
      options?: {
        futureMinimumMetas?: TemplateMeta[];
        coverageMetas?: TemplateMeta[];
        candidateRows?: number[];
        concurrentLimit?: number;
      }
    ) => {
      const candidateRows = options?.candidateRows ?? [row];
      const candidates = employees
        .map((emp) =>
          buildPlacementCandidate({
            meta,
            emp,
            row,
            span,
            candidateRows,
            futureMinimumMetas: options?.futureMinimumMetas,
            coverageMetas: options?.coverageMetas,
            concurrentLimit: options?.concurrentLimit,
          })
        )
        .filter((candidate): candidate is PlacementCandidate => !!candidate)
        .sort(comparePlacementCandidates);

      return candidates[0] ?? null;
    };

    const templatesToSchedule = templates
      .filter((t) => t.enabled !== false)
      .filter(templateApplies)
      .map(buildMeta)
      .filter((t): t is TemplateMeta => !!t)
      .sort((a, b) => {
        const aPriority = getAutofillTemplatePriority(a);
        const bPriority = getAutofillTemplatePriority(b);
        if (aPriority !== bPriority) return bPriority - aPriority;
        return 0;
      });
    const finalPassTemplates = templatesToSchedule.filter(
      (meta) => !meta.fixedTimeBlock && (meta.attendedByAll || meta.overwriteExistingTasks)
    );
    const templatesForPrimaryPass = templatesToSchedule.filter(
      (meta) => !meta.attendedByAll && !meta.overwriteExistingTasks
    );

    const getCandidateRowsForEmployee = (
      meta: TemplateMeta,
      emp: Employee,
      rows: number[],
      concurrentLimit = meta.maxConcurrentPerTimeslot
    ) => {
      const col = employeeColById.get(emp.id) ?? employees.findIndex((e) => e.id === emp.id) + 2;
      const window = getEmployeeWindow(emp);
      if (!window) return [];

      const overlapStart = Math.max(window.startRow, meta.window?.startRow ?? window.startRow);
      const overlapEnd = Math.min(window.endRow, meta.window?.endRow ?? window.endRow);
      const latestStart = Math.max(overlapStart, overlapEnd - meta.span);
      const idealRow = overlapStart <= latestStart ? (overlapStart + latestStart) / 2 : overlapStart;

      return rows
        .filter((row) => {
          const span = getSpanForMeta(meta, row, meta.window?.endRow ?? maxRowEx, { ignoreWindow: false });
          if (!span) return false;
          return (
            isFree(col, row, span, emp.id) &&
            !exceedsConcurrentLimit(meta.id, row, span, concurrentLimit) &&
            !exceedsConsecutiveLimit(meta, col, row, span)
          );
        })
        .sort((a, b) => {
          const spanA = getSpanForMeta(meta, a, meta.window?.endRow ?? maxRowEx, { ignoreWindow: false });
          const spanB = getSpanForMeta(meta, b, meta.window?.endRow ?? maxRowEx, { ignoreWindow: false });
          const overlapA = spanA ? countConcurrentAssignments(meta.id, a, spanA) : Number.POSITIVE_INFINITY;
          const overlapB = spanB ? countConcurrentAssignments(meta.id, b, spanB) : Number.POSITIVE_INFINITY;
          if (overlapA !== overlapB) return overlapA - overlapB;
          const variantRankA = getRowVariantRank(rows, a, autofillVariant);
          const variantRankB = getRowVariantRank(rows, b, autofillVariant);
          if (variantRankA !== variantRankB) return variantRankA - variantRankB;
          const distanceA = Math.abs(a - idealRow);
          const distanceB = Math.abs(b - idealRow);
          if (distanceA !== distanceB) return distanceA - distanceB;
          return a - b;
        });
    };

    const getCoverageAvailabilityStats = (
      emp: Employee,
      blockedRange: { startRow: number; span: number },
      coverageMetas: TemplateMeta[]
    ) => {
      const stats = {
        blockedRows: 0,
        tightestCoverage: Number.POSITIVE_INFINITY,
        totalOptions: 0,
      };

      for (const coverageMeta of coverageMetas) {
        if (!coverageMeta.window) continue;
        const overlapStart = Math.max(blockedRange.startRow, coverageMeta.window.startRow);
        const overlapEnd = Math.min(
          blockedRange.startRow + blockedRange.span,
          coverageMeta.window.endRow
        );
        if (overlapEnd <= overlapStart) continue;

        for (let row = overlapStart; row < overlapEnd; row += 1) {
          const requiredSpan = getSpanForMeta(
            coverageMeta,
            row,
            coverageMeta.window.endRow,
            { ignoreWindow: false }
          );
          if (!requiredSpan) continue;

          const availableEmployees = employees.filter((otherEmp) => {
            if (otherEmp.id === emp.id) return false;
            if (getEmpCount(coverageMeta.id, otherEmp.id) >= coverageMeta.maxPerEmp) return false;
            const col =
              employeeColById.get(otherEmp.id) ??
              employees.findIndex((entry) => entry.id === otherEmp.id) + 2;
            return (
              isFree(col, row, requiredSpan, otherEmp.id) &&
              !exceedsConcurrentLimit(
                coverageMeta.id,
                row,
                requiredSpan,
                coverageMeta.maxConcurrentPerTimeslot
              ) &&
              !exceedsConsecutiveLimit(coverageMeta, col, row, requiredSpan)
            );
          }).length;

          stats.blockedRows += availableEmployees === 0 ? 1 : 0;
          stats.tightestCoverage = Math.min(stats.tightestCoverage, availableEmployees);
          stats.totalOptions += availableEmployees;
        }
      }

      return stats;
    };

    const compareCoverageAvailability = (
      a: { blockedRows: number; tightestCoverage: number; totalOptions: number },
      b: { blockedRows: number; tightestCoverage: number; totalOptions: number }
    ) => {
      if (a.blockedRows !== b.blockedRows) return a.blockedRows - b.blockedRows;
      if (a.tightestCoverage !== b.tightestCoverage) return b.tightestCoverage - a.tightestCoverage;
      if (a.totalOptions !== b.totalOptions) return b.totalOptions - a.totalOptions;
      return 0;
    };

    const getAdjacentTasksAroundRange = (col: number, startRow: number, span: number) => {
      const list = tasksByCol.get(col) ?? [];
      const endRow = startRow + span;
      let prev: GridTask | null = null;
      let next: GridTask | null = null;

      for (const task of list) {
        const taskEnd = task.startRow + task.span;
        if (taskEnd <= startRow) {
          if (!prev || taskEnd > prev.startRow + prev.span) {
            prev = task;
          }
        } else if (task.startRow >= endRow) {
          if (!next || task.startRow < next.startRow) {
            next = task;
          }
        }
      }

      return { prev, next };
    };

    const getPlacementCenterDistance = (
      meta: TemplateMeta,
      emp: Employee,
      row: number,
      span: number
    ) => {
      const employeeWindow = getEmployeeWindow(emp);
      const windowStart = Math.max(employeeWindow?.startRow ?? MIN_ROW, meta.window?.startRow ?? MIN_ROW);
      const windowEnd = Math.min(employeeWindow?.endRow ?? maxRowEx, meta.window?.endRow ?? maxRowEx);
      const latestStart = Math.max(windowStart, windowEnd - span);
      const center = windowStart <= latestStart ? (windowStart + latestStart) / 2 : windowStart;
      return Math.abs(row - center);
    };

    const getPlacementGapPenalty = (
      emp: Employee,
      col: number,
      row: number,
      span: number
    ) => {
      const employeeWindow = getEmployeeWindow(emp);
      if (!employeeWindow) return Number.POSITIVE_INFINITY;

      const { prev, next } = getAdjacentTasksAroundRange(col, row, span);
      const prevEnd = prev ? prev.startRow + prev.span : employeeWindow.startRow;
      const nextStart = next ? next.startRow : employeeWindow.endRow;
      const beforeGap = row - prevEnd;
      const afterGap = nextStart - (row + span);

      let penalty = 0;
      if (beforeGap === 1) penalty += 6;
      if (afterGap === 1) penalty += 6;
      return penalty;
    };

    const getPlacementTransitionPenalty = (
      meta: TemplateMeta,
      col: number,
      row: number,
      span: number
    ) => {
      const { prev, next } = getAdjacentTasksAroundRange(col, row, span);
      let penalty = 0;

      if (prev?.type === meta.id) penalty -= 1;
      else if (prev) penalty += 0.5;

      if (next?.type === meta.id) penalty -= 1;
      else if (next) penalty += 0.5;

      if (prev && next && prev.type === next.type && prev.type !== meta.id) {
        penalty += 1;
      }

      return penalty;
    };

    const buildPlacementCandidate = (input: {
      meta: TemplateMeta;
      emp: Employee;
      row: number;
      span: number;
      candidateRows: number[];
      futureMinimumMetas?: TemplateMeta[];
      coverageMetas?: TemplateMeta[];
      concurrentLimit?: number;
      ignoreEmpLimit?: boolean;
    }): PlacementCandidate | null => {
      const meta = input.meta;
      const col = employeeColById.get(input.emp.id) ?? employees.findIndex((e) => e.id === input.emp.id) + 2;
      const protectedRange = getProtectedRangeForMeta(meta, input.row, input.span);

      if (!input.ignoreEmpLimit && getEmpCount(meta.id, input.emp.id) >= meta.maxPerEmp) return null;
      if (meta.protectsTourWindow && getProtectedTaskConflictInColumn(col, protectedRange)) return null;
      if (!isFree(col, input.row, input.span, input.emp.id)) return null;
      if (
        exceedsConcurrentLimit(
          meta.id,
          input.row,
          input.span,
          input.concurrentLimit ?? meta.maxConcurrentPerTimeslot
        )
      ) {
        return null;
      }
      if (exceedsConsecutiveLimit(meta, col, input.row, input.span)) return null;

      const blockedRange = { startRow: input.row, span: input.span };
      return {
        meta,
        emp: input.emp,
        row: input.row,
        span: input.span,
        col,
        futureAvailability: getFutureMinimumAvailabilityCounts(
          input.emp,
          blockedRange,
          input.futureMinimumMetas ?? []
        ),
        coverageAvailability: getCoverageAvailabilityStats(
          input.emp,
          blockedRange,
          input.coverageMetas ?? []
        ),
        activeCount: countConcurrentAssignments(meta.id, input.row, input.span),
        empCount: getEmpCount(meta.id, input.emp.id),
        totalCount: getTotal(meta.id),
        centerDistance: getPlacementCenterDistance(meta, input.emp, input.row, input.span),
        transitionPenalty: getPlacementTransitionPenalty(meta, col, input.row, input.span),
        gapPenalty: getPlacementGapPenalty(input.emp, col, input.row, input.span),
        rowRank: getRowVariantRank(input.candidateRows, input.row, autofillVariant),
      };
    };

    const comparePlacementCandidates = (a: PlacementCandidate, b: PlacementCandidate) => {
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

      return (
        getRotatedRank(employeeOrder.get(a.emp.id) ?? 0, employees.length, autofillVariant) -
        getRotatedRank(employeeOrder.get(b.emp.id) ?? 0, employees.length, autofillVariant)
      );
    };

    const assignMinimumsForMeta = (
      meta: TemplateMeta,
      candidateRows: number[],
      futureMinimumMetas: TemplateMeta[] = [],
      coverageMetas: TemplateMeta[] = []
    ) => {
      const pendingEmployees = employees.flatMap((emp) =>
        Array.from(
          { length: Math.max(0, meta.minPerEmp - getEmpCount(meta.id, emp.id)) },
          () => emp
        )
      );

      const backtrack = (remaining: Employee[], concurrentLimit: number): boolean => {
        if (!remaining.length) return true;

        let bestIndex = -1;
        let bestRows: number[] | null = null;
        for (let index = 0; index < remaining.length; index += 1) {
          const rows = getCandidateRowsForEmployee(meta, remaining[index], candidateRows, concurrentLimit);
          if (rows.length === 0) return false;
          if (bestRows === null || rows.length < bestRows.length) {
            bestRows = rows;
            bestIndex = index;
          }
        }

        if (bestIndex < 0 || !bestRows) return false;

        const emp = remaining[bestIndex];
        const col = employeeColById.get(emp.id) ?? employees.findIndex((e) => e.id === emp.id) + 2;
        const nextRemaining = remaining.slice(0, bestIndex).concat(remaining.slice(bestIndex + 1));

        const rankedRows = bestRows
          .map((row) => {
            const span = getSpanForMeta(meta, row, meta.window?.endRow ?? maxRowEx, { ignoreWindow: false });
            if (!span) return null;
            const blockedRange = { startRow: row, span };
            return {
              row,
              span,
              futureAvailability: getFutureMinimumAvailabilityCounts(emp, blockedRange, futureMinimumMetas),
              coverageAvailability: getCoverageAvailabilityStats(emp, blockedRange, coverageMetas),
            };
          })
          .filter(
            (
              entry
            ): entry is {
              row: number;
              span: number;
              futureAvailability: number[];
              coverageAvailability: { blockedRows: number; tightestCoverage: number; totalOptions: number };
            } => !!entry
          )
          .sort((a, b) => {
            const coverageDiff = compareCoverageAvailability(
              a.coverageAvailability,
              b.coverageAvailability
            );
            if (coverageDiff !== 0) return coverageDiff;
            const futureDiff = compareFutureMinimumAvailability(
              a.futureAvailability,
              b.futureAvailability
            );
            if (futureDiff !== 0) return futureDiff;
            const variantDiff =
              getRowVariantRank(candidateRows, a.row, autofillVariant) -
              getRowVariantRank(candidateRows, b.row, autofillVariant);
            if (variantDiff !== 0) return variantDiff;
            return a.row - b.row;
          });

        for (const option of rankedRows) {
          const { row, span } = option;
          const task = addTask(meta, col, row, span, emp.id);
          if (backtrack(nextRemaining, concurrentLimit)) return true;
          removeTask(task, meta, emp.id);
        }

        return false;
      };

      const preferredConcurrentLimit = getPreferredConcurrentLimit(meta.maxConcurrentPerTimeslot, {
        preferSolo: !meta.mustManned,
      });
      if (backtrack(pendingEmployees, preferredConcurrentLimit)) return true;
      if (preferredConcurrentLimit === meta.maxConcurrentPerTimeslot) return false;
      return backtrack(pendingEmployees, meta.maxConcurrentPerTimeslot);
    };

    if (!templatesToSchedule.length) {
      applyRosterState(employees, []);
      return;
    }

    const unmetMinimums: string[] = [];
    const protectedTaskFailures: string[] = [];
    placeImportedSchoolTours();

    const getFixedBlockCandidateRows = (meta: TemplateMeta) => {
      if (meta.regularTimeRows.length > 0) return meta.regularTimeRows;
      if (!meta.window) return [];
      if (meta.mustManned) {
        return Array.from(
          { length: Math.max(0, meta.window.endRow - meta.window.startRow) },
          (_, index) => meta.window!.startRow + index
        );
      }
      return getCandidateRowsForMeta(meta);
    };

    const reserveFixedTimeBlocksBeforeInfill = () => {
      const fixedBlockMetas = templatesToSchedule.filter((meta) => meta.fixedTimeBlock);

      for (const meta of fixedBlockMetas) {
        const candidateRows = getFixedBlockCandidateRows(meta);
        const desiredPlacements = Math.min(
          meta.hasFixedTimes || meta.mustManned ? candidateRows.length : 1,
          meta.limitPerDay
        );
        let placementsMade = 0;

        for (const row of candidateRows) {
          if (placementsMade >= desiredPlacements) break;
          if (getTotal(meta.id) >= meta.limitPerDay) break;
          const span = getSpanForMeta(meta, row, meta.window?.endRow ?? maxRowEx, { ignoreWindow: false });
          if (!span) continue;

          const sortedEmployees = employees
            .filter((emp) => {
              const window = getEmployeeWindow(emp);
              return !!window && row >= window.startRow && row + span <= window.endRow;
            })
            .filter((emp) => {
              if (getEmpCount(meta.id, emp.id) >= meta.maxPerEmp) return false;
              const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
              return !exceedsConsecutiveLimit(meta, col, row, span);
            })
            .sort((a, b) => {
              const colA = employeeColById.get(a.id) ?? employees.findIndex((entry) => entry.id === a.id) + 2;
              const colB = employeeColById.get(b.id) ?? employees.findIndex((entry) => entry.id === b.id) + 2;
              const adjacencyDiff =
                getProtectedAdjacencyScore(colA, row, span) -
                getProtectedAdjacencyScore(colB, row, span);
              if (adjacencyDiff !== 0) return adjacencyDiff;
              const countDiff = getEmpCount(meta.id, a.id) - getEmpCount(meta.id, b.id);
              if (countDiff !== 0) return countDiff;
              return (
                getRotatedRank(employeeOrder.get(a.id) ?? 0, employees.length, autofillVariant) -
                getRotatedRank(employeeOrder.get(b.id) ?? 0, employees.length, autofillVariant)
              );
            });

          if (meta.attendedByAll) {
            const placedEmployees = sortedEmployees.filter((emp) => {
              const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
              return isFree(col, row, span, emp.id) && !exceedsConsecutiveLimit(meta, col, row, span);
            });
            if (!placedEmployees.length) {
              protectedTaskFailures.push(`${meta.template.name} ${timeRangeForSpan(row, span)}`);
              continue;
            }
            placedEmployees.forEach((emp) => {
              const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
              addTask(meta, col, row, span, emp.id);
            });
            placementsMade += 1;
            continue;
          }

          const picked = sortedEmployees.find((emp) => {
            const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
            return isFree(col, row, span, emp.id);
          });
          if (!picked) {
            protectedTaskFailures.push(`${meta.template.name} ${timeRangeForSpan(row, span)}`);
            continue;
          }

          const col = employeeColById.get(picked.id) ?? employees.findIndex((entry) => entry.id === picked.id) + 2;
          addTask(meta, col, row, span, picked.id);
          placementsMade += 1;
        }
      }
    };

    reserveFixedTimeBlocksBeforeInfill();

    const collectPlacementCandidatesForMeta = (
      meta: TemplateMeta,
      candidateRows: number[],
      options?: {
        futureMinimumMetas?: TemplateMeta[];
        coverageMetas?: TemplateMeta[];
        employeesSubset?: Employee[];
        concurrentLimit?: number;
        singlePerRow?: boolean;
      }
    ) => {
      const candidates: PlacementCandidate[] = [];
      const employeePool = options?.employeesSubset ?? employees;

      for (const row of candidateRows) {
        const span = getSpanForMeta(meta, row, meta.window?.endRow ?? maxRowEx, { ignoreWindow: false });
        if (!span) continue;
        if (options?.singlePerRow && generated.some((task) => task.type === meta.id && task.startRow === row)) {
          continue;
        }

        for (const emp of employeePool) {
          const candidate = buildPlacementCandidate({
            meta,
            emp,
            row,
            span,
            candidateRows,
            futureMinimumMetas: options?.futureMinimumMetas,
            coverageMetas: options?.coverageMetas,
            concurrentLimit: options?.concurrentLimit,
          });
          if (candidate) {
            candidates.push(candidate);
          }
        }
      }

      return candidates.sort(comparePlacementCandidates);
    };

    const schedulePrimaryMeta = (
      meta: TemplateMeta,
      futureMinimumMetas: TemplateMeta[] = [],
      coverageMetas: TemplateMeta[] = []
    ) => {
      const window = meta.window;
      if (!window || isAutofillFillerTemplate(meta)) return;

      const limitPerDay = meta.limitPerDay;
      const maxPerEmp = meta.maxPerEmp;
      const minPerEmp = meta.minPerEmp;

      if (meta.mustManned) {
        const requiredRows =
          meta.hasFixedTimes
            ? meta.regularTimeRows
            : Array.from(
                { length: Math.max(0, window.endRow - window.startRow) },
                (_, index) => window.startRow + index
              );
        const orderedRequiredRows =
          meta.regularTimeRows.length === 0 && Number.isFinite(limitPerDay) && limitPerDay < requiredRows.length
            ? [...requiredRows].sort((a, b) => {
                const spanA = getSpanForMeta(meta, a, window.endRow, { ignoreWindow: false });
                const spanB = getSpanForMeta(meta, b, window.endRow, { ignoreWindow: false });
                const feasibleA = spanA
                  ? employees.filter((emp) => {
                      if (getEmpCount(meta.id, emp.id) >= meta.maxPerEmp) return false;
                      const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
                      return (
                        isFree(col, a, spanA, emp.id) &&
                        !exceedsConcurrentLimit(meta.id, a, spanA, meta.maxConcurrentPerTimeslot) &&
                        !exceedsConsecutiveLimit(meta, col, a, spanA)
                      );
                    }).length
                  : Number.POSITIVE_INFINITY;
                const feasibleB = spanB
                  ? employees.filter((emp) => {
                      if (getEmpCount(meta.id, emp.id) >= meta.maxPerEmp) return false;
                      const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
                      return (
                        isFree(col, b, spanB, emp.id) &&
                        !exceedsConcurrentLimit(meta.id, b, spanB, meta.maxConcurrentPerTimeslot) &&
                        !exceedsConsecutiveLimit(meta, col, b, spanB)
                      );
                    }).length
                  : Number.POSITIVE_INFINITY;
                if (feasibleA !== feasibleB) return feasibleA - feasibleB;
                return b - a;
              })
            : requiredRows;

        for (const row of orderedRequiredRows) {
          if (getTotal(meta.id) >= limitPerDay) break;
          const requiredSpan = getSpanForMeta(meta, row, window.endRow, { ignoreWindow: false });
          if (!requiredSpan) continue;
          const alreadyCovered =
            meta.regularTimeRows.length > 0
              ? generated.some((task) => task.type === meta.id && task.startRow === row)
              : isTypeCoveredAt(meta.id, row);
          if (alreadyCovered) continue;
          const picked = pickPlacementForRow(meta, row, requiredSpan, {
            futureMinimumMetas,
            candidateRows: orderedRequiredRows,
          });
          if (!picked) continue;
          addTask(meta, picked.col, row, requiredSpan, picked.emp.id);
        }
        return;
      }

      const candidateRows =
        meta.regularTimeRows.length > 0
          ? meta.regularTimeRows
          : Array.from(
              { length: Math.max(0, window.endRow - window.startRow) },
              (_, index) => window.startRow + index
            ).filter((row) => !!getSpanForMeta(meta, row, window.endRow, { ignoreWindow: false }));

      if (candidateRows.length === 0) return;

      if (minPerEmp > 0) {
        const minimumsSatisfied = assignMinimumsForMeta(meta, candidateRows, futureMinimumMetas, coverageMetas);
        if (!minimumsSatisfied) {
          const unmetEmployees = employees
            .filter((emp) => getEmpCount(meta.id, emp.id) < minPerEmp)
            .map((emp) => emp.name);
          if (unmetEmployees.length) {
            unmetMinimums.push(`${meta.template.name}: ${unmetEmployees.join(", ")}`);
          }
          return;
        }
      }

      let desiredCount = 1;
      if (meta.hasFixedTimes || meta.mustManned) {
        desiredCount = candidateRows.length;
      } else if (Number.isFinite(meta.template.limitPerDay) && (meta.template.limitPerDay ?? 0) > 0) {
        desiredCount = meta.template.limitPerDay as number;
      } else if (minPerEmp > 0) {
        desiredCount = minPerEmp * employees.length;
      }
      desiredCount = Math.min(desiredCount, limitPerDay);

      while (getTotal(meta.id) < desiredCount && getTotal(meta.id) < limitPerDay) {
        const candidates = collectPlacementCandidatesForMeta(meta, candidateRows, {
          futureMinimumMetas,
          coverageMetas,
          singlePerRow: meta.hasFixedTimes,
        });
        const picked = candidates[0];
        if (!picked) break;
        addTask(meta, picked.col, picked.row, picked.span, picked.emp.id);
      }
    };

    const minimumTemplates = templatesForPrimaryPass.filter(isMinimumMeta);
    const coverageTemplates = templatesForPrimaryPass.filter((meta) => meta.mustManned);
    const otherPrimaryTemplates = templatesForPrimaryPass.filter(
      (meta) => !meta.mustManned && !isMinimumMeta(meta) && !isAutofillFillerTemplate(meta)
    );

    minimumTemplates.forEach((meta, index) => {
      schedulePrimaryMeta(meta, minimumTemplates.slice(index + 1), coverageTemplates);
    });
    coverageTemplates.forEach((meta) => schedulePrimaryMeta(meta));
    otherPrimaryTemplates.forEach((meta) => schedulePrimaryMeta(meta));

    const fillTemplates = templatesForPrimaryPass.filter(isAutofillFillerTemplate);

    const getFreeSegmentsForColumnRange = (col: number, startRow: number, endRow: number) => {
      const list = (tasksByCol.get(col) ?? []).slice().sort((a, b) => a.startRow - b.startRow);
      const segments: Array<{ startRow: number; endRow: number }> = [];
      let cursor = startRow;

      for (const task of list) {
        if (task.startRow + task.span <= startRow) continue;
        if (task.startRow >= endRow) break;
        if (cursor < task.startRow) {
          segments.push({ startRow: cursor, endRow: Math.min(task.startRow, endRow) });
        }
        cursor = Math.max(cursor, task.startRow + task.span);
        if (cursor >= endRow) break;
      }

      if (cursor < endRow) {
        segments.push({ startRow: cursor, endRow });
      }

      return segments.filter((segment) => segment.endRow > segment.startRow);
    };

    const collectGapFillCandidates = (
      emp: Employee,
      col: number,
      startRow: number,
      endRow: number,
      options?: { ignoreEmpLimit?: boolean }
    ) => {
      const gapRows = Array.from({ length: Math.max(0, endRow - startRow) }, (_, index) => startRow + index);
      const freeSegments = getFreeSegmentsForColumnRange(col, startRow, endRow);
      const candidates: PlacementCandidate[] = [];

      for (const segment of freeSegments) {
        for (let row = segment.startRow; row < segment.endRow; row += 1) {
          for (const meta of fillTemplates) {
            if (getTotal(meta.id) >= meta.limitPerDay) continue;
            if (meta.window) {
              if (row < meta.window.startRow || row >= meta.window.endRow) continue;
            }

            const segmentEnd = Math.min(segment.endRow, meta.window?.endRow ?? segment.endRow);
            const span = resolveAutofillPlacementSpan({
              baseSpan: meta.span,
              availableSpan: segmentEnd - row,
              allowShrink: meta.allowShrink,
              minSpan: meta.minSpan,
              maxConsecutiveSpan: meta.maxConsecutiveSpan,
              fillerChunkSpan: 2,
            });
            if (!span) continue;

            const candidate = buildPlacementCandidate({
              meta,
              emp,
              row,
              span,
              candidateRows: gapRows,
              ignoreEmpLimit: options?.ignoreEmpLimit,
            });
            if (candidate) {
              candidates.push(candidate);
            }
          }
        }
      }

      return candidates.sort(comparePlacementCandidates);
    };

    const fillGap = (col: number, empId: string | number, startRow: number, endRow: number) => {
      const emp = employees.find((entry) => entry.id === empId);
      if (!emp) return;

      while (true) {
        const pickedStrict = collectGapFillCandidates(emp, col, startRow, endRow);
        const pickedRelaxed = pickedStrict.length
          ? pickedStrict
          : collectGapFillCandidates(emp, col, startRow, endRow, { ignoreEmpLimit: true });
        const picked = pickedStrict[0] || pickedRelaxed[0];
        if (!picked) {
          break;
        }
        addTask(picked.meta, col, picked.row, picked.span, empId);
      }
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

    const getEligibleEmployeesForRow = (row: number, span: number) =>
      employees.filter((emp) => {
        const window = getEmployeeWindow(emp);
        return !!window && row >= window.startRow && row + span <= window.endRow;
      });

    const getConflictCount = (col: number, startRow: number, span: number) =>
      (tasksByCol.get(col) ?? []).filter(
        (task) => startRow < task.startRow + task.span && startRow + span > task.startRow
      ).length;

    const placeFinalTask = (
      meta: TemplateMeta,
      col: number,
      row: number,
      span: number,
      empId: string | number
    ) => {
      const blockedRange = getProtectedRangeForMeta(meta, row, span);
      if (exceedsConsecutiveLimit(meta, col, row, span)) {
        return false;
      }
      if (meta.overwriteExistingTasks) {
        if (hasProtectedMinimumConflictInColumn(col, blockedRange)) {
          return false;
        }
        if (meta.protectsTourWindow && getProtectedTaskConflictInColumn(col, blockedRange)) {
          return false;
        }
        if (!meta.protectsTourWindow && overlapsProtectedTaskInColumn(col, blockedRange)) {
          return false;
        }
        const supportBlocked =
          meta.protectsTourWindow &&
          getSupportRangesForProtectedMeta(meta, row, span).some((range) => !isColumnRangeFree(col, range));
        if (supportBlocked) {
          return false;
        }
        clipConflictsInColumn(col, blockedRange.startRow, blockedRange.span);
      } else if (!isFree(col, row, span, empId)) {
        return false;
      }
      addTask(meta, col, row, span, empId);
      return true;
    };

    const scheduleAttendedByAllMeta = (meta: TemplateMeta) => {
      const candidateRows = getCandidateRowsForMeta(meta);
      const desiredPlacements = getDesiredPlacements(meta, candidateRows);
      let placementsMade = 0;

      for (const row of candidateRows) {
        if (placementsMade >= desiredPlacements) break;
        const span = getSpanForMeta(meta, row, meta.window?.endRow ?? maxRowEx, { ignoreWindow: false });
        if (!span) continue;

        const eligibleEmployees = getEligibleEmployeesForRow(row, span);
        if (!eligibleEmployees.length) continue;
        if (!meta.overwriteExistingTasks) {
          const blocked = eligibleEmployees.some((emp) => {
            const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
            return !isFree(col, row, span, emp.id);
          });
          if (blocked) continue;
        }

        eligibleEmployees.forEach((emp) => {
          const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
          placeFinalTask(meta, col, row, span, emp.id);
        });
        placementsMade += 1;
      }
    };

    const scheduleOverrideMeta = (meta: TemplateMeta) => {
      const candidateRows = getCandidateRowsForMeta(meta);
      const desiredPlacements = getDesiredPlacements(meta, candidateRows);

      for (const row of candidateRows) {
        if (getTotal(meta.id) >= desiredPlacements) break;
        if (getTotal(meta.id) >= meta.limitPerDay) break;
        const span = getSpanForMeta(meta, row, meta.window?.endRow ?? maxRowEx, { ignoreWindow: false });
        if (!span) continue;

        const sortedEmployees = getEligibleEmployeesForRow(row, span)
          .filter((emp) => getEmpCount(meta.id, emp.id) < meta.maxPerEmp)
          .sort((a, b) => {
            const conflictDiff =
              getConflictCount(employeeColById.get(a.id) ?? employees.findIndex((entry) => entry.id === a.id) + 2, row, span) -
              getConflictCount(employeeColById.get(b.id) ?? employees.findIndex((entry) => entry.id === b.id) + 2, row, span);
            if (conflictDiff !== 0) return conflictDiff;
            const countDiff = getEmpCount(meta.id, a.id) - getEmpCount(meta.id, b.id);
            if (countDiff !== 0) return countDiff;
            return (
              getRotatedRank(employeeOrder.get(a.id) ?? 0, employees.length, autofillVariant) -
              getRotatedRank(employeeOrder.get(b.id) ?? 0, employees.length, autofillVariant)
            );
          });

        for (const emp of sortedEmployees) {
          const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
          if (!meta.overwriteExistingTasks && !isFree(col, row, span, emp.id)) continue;
          if (placeFinalTask(meta, col, row, span, emp.id)) {
            break;
          }
        }

        if (
          meta.protectsTourWindow &&
          !generated.some((task) => task.type === meta.id && task.startRow === row)
        ) {
          protectedTaskFailures.push(`${meta.template.name} ${timeRangeForSpan(row, span)}`);
        }
      }
    };

    finalPassTemplates.forEach((meta) => {
      if (meta.attendedByAll) {
        scheduleAttendedByAllMeta(meta);
        return;
      }
      scheduleOverrideMeta(meta);
    });

    employees.forEach((emp, idx) => {
      const col = employeeColById.get(emp.id) ?? idx + 2;
      const list = (tasksByCol.get(col) ?? []).slice().sort((a, b) => a.startRow - b.startRow);
      const window = getEmployeeWindow(emp);
      if (!window) return;
      let cursor = window.startRow;
      for (const task of list) {
        if (cursor < task.startRow) {
          fillGap(col, emp.id, cursor, task.startRow);
        }
        cursor = Math.max(cursor, task.startRow + task.span);
      }
      if (cursor < window.endRow) {
        fillGap(col, emp.id, cursor, window.endRow);
      }
    });

    const unmetCoverage = templatesForPrimaryPass
      .filter((meta) => meta.mustManned && meta.window)
      .flatMap((meta) => {
        const window = meta.window!;
        if (meta.hasFixedTimes) {
          return meta.regularTimeRows
            .filter((row) => !generated.some((task) => task.type === meta.id && task.startRow === row))
            .map((row) => {
              const span = getSpanForMeta(meta, row, window.endRow, { ignoreWindow: false }) || 1;
              return `${meta.template.name} ${timeRangeForSpan(row, span)}`;
            });
        }

        const gaps: string[] = [];
        let gapStart: number | null = null;
        for (let row = window.startRow; row < window.endRow; row += 1) {
          const covered = isTypeCoveredAt(meta.id, row);
          if (!covered && gapStart === null) {
            gapStart = row;
          } else if (covered && gapStart !== null) {
            gaps.push(`${meta.template.name} ${timeRangeForSpan(gapStart, row - gapStart)}`);
            gapStart = null;
          }
        }
        if (gapStart !== null) {
          gaps.push(`${meta.template.name} ${timeRangeForSpan(gapStart, window.endRow - gapStart)}`);
        }
        return gaps;
      });

    const ordered = generated.sort((a, b) => (a.col - b.col) || (a.startRow - b.startRow));
    applyRosterState(employees, ordered);
    const alertMessages: string[] = [];
    if (unmetMinimums.length) {
      alertMessages.push(`Autofill could not place required tasks for: ${unmetMinimums.join(", ")}`);
    }
    if (unmetCoverage.length) {
      alertMessages.push(`Autofill could not fully man: ${unmetCoverage.join(", ")}`);
    }
    if (protectedTaskFailures.length) {
      alertMessages.push(`Autofill could not place protected tasks without overlap: ${protectedTaskFailures.join(", ")}`);
    }
    if (importedSchoolTourFailures.length) {
      alertMessages.push(`Autofill could not place school tours: ${importedSchoolTourFailures.join(", ")}`);
    }
    onAutofillNoticeChange?.(
      alertMessages.length
        ? {
            title: "Autofill note",
            messages: alertMessages,
          }
        : null
    );
  */

  const saveRoster = useCallback(async (options?: { mode?: "autosave" | "manual"; keepalive?: boolean }) => {
    const mode = options?.mode ?? "manual";
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    if (saveInFlightRef.current) {
      queuedSaveModeRef.current = mode;
      return;
    }

    const snapshotEmployees = cloneEmployees(employeesRef.current);
    const snapshotTasks = cloneTasks(tasksRef.current);
    const snapshotSchoolTours = cloneSchoolTours(schoolToursRef.current);
    const snapshotHours = { ...hoursRef.current };
    const nextSignature = buildRosterSaveSignature(
      snapshotEmployees,
      snapshotTasks,
      snapshotSchoolTours,
      snapshotHours.start,
      snapshotHours.end,
      rosterDateId
    );

    if (nextSignature === lastSavedSignatureRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    const saveCycle = saveCycleRef.current;
    onSaveStateChange?.({ state: "saving", mode });

    try {
      const res = await fetch("/api/rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: rosterDateId,
          employees: snapshotEmployees,
          tasks: [...snapshotTasks, ...encodeSchoolToursAsTasks(snapshotSchoolTours)],
          hoursStart: snapshotHours.start,
          hoursEnd: snapshotHours.end,
        }),
        keepalive: options?.keepalive,
      });
      if (!res.ok) {
        console.error("Save failed", await res.text());
        if (saveCycle === saveCycleRef.current) {
          onSaveStateChange?.({ state: "error", mode });
        }
        return;
      }

        const payload = (await res.json().catch(() => ({}))) as { savedAt?: string };
        if (saveCycle === saveCycleRef.current) {
          lastSavedSignatureRef.current = nextSignature;
          lastSavedAtRef.current =
            typeof payload.savedAt === "string" ? payload.savedAt : new Date().toISOString();
          writeDraftRecord<RosterDraftValue>(draftStorageKey, {
            value: {
              employees: snapshotEmployees,
              tasks: snapshotTasks,
              schoolTours: snapshotSchoolTours,
              hoursStart: snapshotHours.start,
              hoursEnd: snapshotHours.end,
            },
            lastSavedSignature: nextSignature,
            savedAt: lastSavedAtRef.current,
          });
          onSaveStateChange?.({
            state: "saved",
            mode,
            savedAt: lastSavedAtRef.current,
          });
        }
      } catch (err) {
        console.error(err);
        if (saveCycle === saveCycleRef.current) {
        writeDraftRecord<RosterDraftValue>(draftStorageKey, {
          value: {
            employees: snapshotEmployees,
            tasks: snapshotTasks,
            schoolTours: snapshotSchoolTours,
            hoursStart: snapshotHours.start,
            hoursEnd: snapshotHours.end,
          },
          lastSavedSignature: lastSavedSignatureRef.current,
          savedAt: lastSavedAtRef.current,
        });
        onSaveStateChange?.({ state: "error", mode });
      }
    } finally {
      saveInFlightRef.current = false;
      if (queuedSaveModeRef.current) {
        const queuedMode = queuedSaveModeRef.current;
        queuedSaveModeRef.current = null;
        void saveRoster({ mode: queuedMode });
      }
    }
  }, [draftStorageKey, rosterDateId, onSaveStateChange]);

  useEffect(() => {
    if (suspendDraftEffectsRef.current) return;
    const nextSignature = buildRosterSaveSignature(
      employees,
      tasks,
      schoolTours,
      hoursStart,
      hoursEnd,
      rosterDateId
    );
    if (nextSignature === lastSavedSignatureRef.current) return;
    onSaveStateChange?.({ state: "dirty", mode: "autosave", savedAt: lastSavedAtRef.current });
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void saveRoster({ mode: "autosave" });
    }, 700);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [employees, schoolTours, tasks, hoursStart, hoursEnd, rosterDateId, saveRoster, onSaveStateChange]);

  useEffect(() => {
    const flushAutosave = () => {
      const nextSignature = buildRosterSaveSignature(
        employeesRef.current,
        tasksRef.current,
        schoolToursRef.current,
        hoursRef.current.start,
        hoursRef.current.end,
        rosterDateId
      );
      if (nextSignature === lastSavedSignatureRef.current) return;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
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

  const clearNonLockedTasks = useCallback(() => {
    const nextTasks = tasksRef.current.filter((task) => isTaskLocked(task));
    if (applyRosterState(employeesRef.current, nextTasks)) {
      setSelected(undefined);
    }
  }, [applyRosterState]);

  const deleteSelectedTask = useCallback(() => {
    if (selected === undefined) return;
    const prevTasks = tasksRef.current;
    const target = prevTasks.find((task) => task.id === selected);
    if (!target || isTaskLocked(target)) return;
    const nextTasks = prevTasks.filter((task) => task.id !== selected);
    if (applyRosterState(employeesRef.current, nextTasks)) {
      setSelected(undefined);
    }
  }, [selected, applyRosterState]);

  useEffect(() => {
    const handler = () => { openAddEmployeePicker(); };
    window.addEventListener("roster:add-employee", handler);
    return () => window.removeEventListener("roster:add-employee", handler);
  }, [openAddEmployeePicker]);

  useEffect(() => {
    const handler = (event: Event) => {
      const file = (event as CustomEvent<{ file?: File }>).detail?.file;
      if (!file) return;
      void importSchoolTours(file).catch((error) => {
        console.error(error);
        const message = error instanceof Error ? error.message : "Unable to import the school tours workbook.";
        window.alert(message);
      });
    };
    window.addEventListener("roster:import-school-tours", handler as EventListener);
    return () => window.removeEventListener("roster:import-school-tours", handler as EventListener);
  }, [importSchoolTours]);

  useEffect(() => {
    if (!addOpen) return;
    setEmployeePickerQuery("");
  }, [addOpen]);

  useEffect(() => {
    if (!addOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAddOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [addOpen]);

  useEffect(() => {
    const handler = () => saveRoster();
    window.addEventListener("roster-save", handler);
    return () => window.removeEventListener("roster-save", handler);
  }, [saveRoster]);

  useEffect(() => {
    const handler = () => clearNonLockedTasks();
    window.addEventListener("roster-clear", handler);
    return () => window.removeEventListener("roster-clear", handler);
  }, [clearNonLockedTasks]);

  useEffect(() => {
    const handler = () => undo();
    window.addEventListener("roster-undo", handler);
    return () => window.removeEventListener("roster-undo", handler);
  }, [undo]);

  useEffect(() => {
    const handler = () => redo();
    window.addEventListener("roster-redo", handler);
    return () => window.removeEventListener("roster-redo", handler);
  }, [redo]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setSelected(undefined);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    const handler = () => resetRoster();
    window.addEventListener("roster-reset", handler);
    return () => window.removeEventListener("roster-reset", handler);
  }, [resetRoster]);

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

  const exportExcel = useCallback(() => {
    const border = "#000000";
    const exportStartMin = dayStartMin;
    const exportEndMin = dayEndMin;
    const exportRowCount = Math.max(1, Math.ceil((exportEndMin - exportStartMin) / 15));
    const tasksByColStart = new Map<number, Map<number, GridTask>>();
    for (const t of tasks) {
      const startMin = dayStartMin + (t.startRow - MIN_ROW) * 15;
      const exportRow = Math.round((startMin - exportStartMin) / 15);
      if (exportRow < 0 || exportRow >= exportRowCount) continue;
      if (!tasksByColStart.has(t.col)) tasksByColStart.set(t.col, new Map());
      tasksByColStart.get(t.col)!.set(exportRow, t);
    }
    const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(rosterDate);
    const formatMinutes = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };
    const timeSpans = new Map<number, { span: number; label: string }>();
    let spanRow = 0;
    while (spanRow < exportRowCount) {
      const startMin = exportStartMin + spanRow * 15;
      const remaining = exportEndMin - startMin;
      let span = 1;
      if (startMin % 30 === 0 && remaining >= 30 && spanRow + 1 < exportRowCount) {
        span = 2;
      }
      const endMin = startMin + span * 15;
      timeSpans.set(spanRow, { span, label: `${formatMinutes(startMin)}-${formatMinutes(endMin)}` });
      spanRow += span;
    }

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    table { border-collapse: collapse; table-layout: fixed; }
    col.time-col { width: 130px; }
    col.emp-col { width: 140px; }
    th { border: 1px solid ${border}; font-family: "Arial", sans-serif; font-size: 12px; text-align: center; vertical-align: middle; padding: 6px; }
    td { font-family: "Arial", sans-serif; font-size: 12px; text-align: center; vertical-align: middle; padding: 6px; }
    .time { background: #f5f5f5; font-weight: 600; padding: 0; border: 1px solid ${border}; }
    .time-box { position: relative; height: 100%; padding: 6px 6px 8px; }
    .time-label { padding-bottom: 4px; }
    .time-mid { border-top: 1px solid #cbd5e1; margin: 0 4px; }
    .heading { background: #ededed; font-weight: 700; }
    .subheading { background: #f4f4f5; font-weight: 600; font-size: 11px; color: #4b5563; }
    .task-cell { padding: 0; }
  </style>
</head>
<body>
  <table>
    <colgroup>
      <col class="time-col" />
      <col class="emp-col" span="${employeeCols.length}" />
    </colgroup>
    <tr>
      <th class="heading" colspan="${employeeCols.length + 1}">${dateLabel}</th>
    </tr>
    <tr>
      <th class="heading"></th>
      ${employeeCols.map(e => `<th class="heading">${e.name}</th>`).join("")}
    </tr>
    <tr>
      <th class="subheading">Hours</th>
      ${employeeCols.map(e => `<th class="subheading">${getEmployeeHoursLabel(e)}</th>`).join("")}
    </tr>
`;

    const rowSpans = employeeCols.map(() => 0);
    const renderRow = (rowNumber: number) => {
      let rowHtml = "<tr>";
      const timeSpan = timeSpans.get(rowNumber);
      if (timeSpan) {
        rowHtml += `<td class="time" rowspan="${timeSpan.span}"><div class="time-box"><div class="time-label">${timeSpan.label}</div><div class="time-mid"></div></div></td>`;
      }
      employeeCols.forEach((emp, colIdx) => {
        if (rowSpans[colIdx] > 0) {
          rowSpans[colIdx]--;
          return;
        }
          const task = tasksByColStart.get(emp.col)?.get(rowNumber);
          if (task) {
            rowSpans[colIdx] = task.span - 1;
          const bg = colorForTask(task) || "#d3e6d5";
          rowHtml += `<td class="task-cell" rowspan="${task.span}" style="background:${bg}; font-weight:600; text-align:center; border:1px solid ${border};">${task.label}</td>`;
        } else {
          const topBorder = rowNumber === 0 ? `border-top:1px solid ${border};` : "border-top:0;";
          const bottomBorder = rowNumber === exportRowCount - 1 ? `border-bottom:1px solid ${border};` : "border-bottom:0;";
          rowHtml += `<td style="border-left:1px solid ${border}; border-right:1px solid ${border}; ${topBorder} ${bottomBorder}"></td>`;
        }
      });
      rowHtml += "</tr>\n";
      return rowHtml;
    };

    for (let rowNumber = 0; rowNumber < exportRowCount; rowNumber += 1) {
      html += renderRow(rowNumber);
    }

    html += `
  </table>
</body>
</html>`;
    const fileName = new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
      .format(rosterDate)
      .replace(",", "");
    onExportWorkbook(html, fileName);
  }, [employeeCols, tasks, onExportWorkbook, colorForTask, timeRangeForSpan, maxRowEx, dayStartMin, dayEndMin, rosterDate, getEmployeeHoursLabel, templateById]);

  useEffect(() => {
    const onExport = () => exportExcel();
    window.addEventListener("roster-export", onExport);
    return () => window.removeEventListener("roster-export", onExport);
  }, [exportExcel]);

  // modal picker
  function openPicker(col: number, row: number) { setModal({ col, row }); }
  function closePicker() { setModal(null); }
  function createFromPicker(template: TaskTemplate) {
    if (!modal) return;
    const type = template?.id || "task";
    const label = template?.name || "Task";
    const id = crypto.randomUUID?.() ?? String(Math.random());
    const nextTasks = [
      ...tasksRef.current,
      {
        id,
        type,
        label,
        col: modal.col,
        startRow: modal.row,
        span: 1,
        color: template.color,
      },
    ];
    applyRosterState(employeesRef.current, nextTasks);
    setSelected(id);
    closePicker();
  }

  // drag/resize with "consume neighbours"
  function onStartResize(which: "top" | "bottom", id: string | number, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    const currentTasks = tasksRef.current;
    const t = currentTasks.find((x) => x.id === id); if (!t) return;
    pushHistorySnapshot(employeesRef.current, currentTasks);
    setDrag({ id, which, y0: e.clientY, start0: t.startRow, span0: t.span });
  }

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const t = tasks.find(x => x.id === drag.id); if (!t) return;
      const dy = e.clientY - drag.y0;
      const dRows = Math.round(dy / rowHeight());
      let newStart = drag.start0, newSpan = drag.span0;
      if (drag.which === "top") {
        newStart = Math.max(MIN_ROW, Math.min(drag.start0 + dRows, drag.start0 + drag.span0 - 1));
        newSpan = drag.start0 + drag.span0 - newStart;
      } else {
        const newEnd = Math.min(maxRowEx, Math.max(drag.start0 + drag.span0 + dRows, drag.start0 + 1));
        newSpan = newEnd - drag.start0;
      }
      setTasks(prev => prev.map(x => x.id === t.id ? ({ ...x, startRow: newStart, span: newSpan }) : x));
    };
    const onUp = () => {
      setTasks(prev => {
        const me = prev.find(x => x.id === drag.id); if (!me) return prev;
        const start = me.startRow, end = me.startRow + me.span;
        const sameCol = prev.filter(x => x.col === me.col && x.id !== me.id);
        const next: GridTask[] = [];
        for (const b of sameCol) {
          const s = b.startRow, e = b.startRow + b.span;
          if (e <= start || s >= end) { next.push(b); }
          else if (s >= start && e <= end) { /* fully consumed */ }
          else if (s < start && e <= end) { next.push({ ...b, span: start - s }); }
          else if (s >= start && e > end) { next.push({ ...b, startRow: end, span: e - end }); }
          else if (s < start && e > end) {
            next.push({ ...b, span: start - s });
            next.push({ ...b, id: (crypto.randomUUID?.() ?? Math.random().toString()), startRow: end, span: e - end });
          }
        }
        const others = prev.filter(x => x.col !== me.col && x.id !== me.id);
        return [...others, me, ...next].sort((a, b) => (a.col - b.col) || (a.startRow - b.startRow));
      });
      setDrag(null); document.body.style.cursor = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "ns-resize";
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; };
  }, [drag, tasks]);

  // empty slots
  const slots: { col: number; row: number }[] = [];
  for (let row = MIN_ROW; row < maxRowEx; row++) {
    for (const c of employeeCols) {
      const exists = blocksInCol(c.col).some(x => row >= x.startRow && row < x.startRow + x.span);
      if (!exists) slots.push({ col: c.col, row });
    }
  }
  const lastCol = displayCols[displayCols.length - 1]?.col;
  const firstEmployeeCol = employeeCols[0]?.col;
  const selectedTaskCol = tasks.find((t) => t.id === selected)?.col ?? null;
  const emphasizedCol = selectedTaskCol;
  const gridLineColor = "rgba(71,85,105,0.98)";
  const lastGridRow = maxRowEx - 1;
  const hasToolbar = toolbar != null;
  const schoolTourCount = schoolTours.length;

  return (
    <div className="flex w-full items-start gap-4 overflow-x-auto">
      <div
        ref={containerRef}
        className="card p-0 inline-block overflow-hidden"
        style={{ borderColor: gridLineColor }}
        onClick={() => setSelected(undefined)}
      >
      {toolbar}
      {/* grid */}
      <div
        className="grid inline-grid"
        style={{
          gridTemplateColumns: `var(--timew) repeat(${displayCols.length}, var(--empw))`,
          gridTemplateRows: "68px",
          gridAutoRows: "var(--rowh)",
        }}
      >
        <div
          className={`sticky left-0 z-40 flex items-center justify-center border-r bg-white px-3 py-1.5 text-center ${hasToolbar ? "" : "rounded-tl-[12px]"}`}
          style={{ borderRightColor: gridLineColor, boxShadow: `inset 0 -1px 0 ${gridLineColor}` }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">Time</span>
        </div>
        {displayCols.map((column) => {
          const resolved = resolveEmployeeHours(column);
          const hoursLabel = resolved.isOff ? "Off" : `${resolved.start} - ${resolved.end}`;
          return (
            <div
              key={column.id}
              className={`group relative flex items-center bg-white px-3 py-1.5 transition ${column.col === lastCol && !hasToolbar ? "rounded-tr-[12px]" : ""}`}
              style={{
                boxShadow: `${column.col === lastCol ? "" : `inset -1px 0 0 ${gridLineColor}, `}inset 0 -1px 0 ${gridLineColor}`,
              }}
            >
              <div className="min-w-0 w-full py-0.5 pr-10">
                <div className="min-w-0">
                  <span className="block max-w-full truncate text-[15px] font-semibold leading-tight tracking-[0.01em] text-slate-900">
                    {column.name}
                  </span>
                  <span className={`mt-0.5 block text-[12px] font-medium tabular-nums ${resolved.isOff ? "italic text-slate-500" : "text-slate-600"}`}>
                    {hoursLabel}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-slate-400/85 bg-white/85 text-slate-600 shadow-sm transition hover:border-slate-500 hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/55"
                onClick={(e) => {
                  e.stopPropagation();
                  openEmployeeSettings({ id: column.id, name: column.name, startTime: column.startTime, endTime: column.endTime });
                }}
                title={`Edit hours for ${column.name}`}
                aria-label={`Edit hours for ${column.name}`}
              >
                <Settings2 className="h-[16px] w-[16px]" />
              </button>
              {employeeSettingsId === column.id && (
                <div
                  ref={employeeSettingsRef}
                  className="absolute right-2 top-9 z-50 w-[280px] max-w-[calc(100vw-1.5rem)] rounded-[10px] border border-[var(--border)] bg-white p-3 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-2">
                    <p className="text-[13px] font-semibold text-slate-800">{column.name}</p>
                    <p className="text-[11px] text-slate-500">Day time override</p>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
                    <div className="min-w-0">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        Start
                      </label>
                      <input
                        type="time"
                        className="input time-input-no-icon h-8 w-full min-w-0 px-2 text-[13px]"
                        value={employeeSettingsDraft.start}
                        step={900}
                        onChange={(e) => {
                          setEmployeeSettingsDraft((prev) => ({ ...prev, start: e.target.value }));
                          setEmployeeSettingsDirty(true);
                          setEmployeeSettingsError("");
                        }}
                      />
                    </div>
                    <span className="pb-2 text-[11px] text-slate-500">to</span>
                    <div className="min-w-0">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        End
                      </label>
                      <input
                        type="time"
                        className="input time-input-no-icon h-8 w-full min-w-0 px-2 text-[13px]"
                        value={employeeSettingsDraft.end}
                        step={900}
                        onChange={(e) => {
                          setEmployeeSettingsDraft((prev) => ({ ...prev, end: e.target.value }));
                          setEmployeeSettingsDirty(true);
                          setEmployeeSettingsError("");
                        }}
                      />
                    </div>
                  </div>
                  {employeeSettingsError && (
                    <p className="mt-2 text-[11px] text-red-600">{employeeSettingsError}</p>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="btn h-8 px-3 text-[12px]" onClick={clearEmployeeSettingsOverride}>
                      Use Default
                    </button>
                    <button
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-[var(--radius-md)] border border-red-300 bg-white px-3 text-[12px] font-medium text-red-700 transition hover:border-red-600 hover:bg-red-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70"
                      onClick={() => {
                        setEmployeeSettingsId(null);
                        setEmployeeSettingsDirty(false);
                        setEmployeeSettingsError("");
                        removeEmployee(column.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {Array.from({ length: maxRowEx - MIN_ROW }).map((_, i) => {
          const r = MIN_ROW + i;
          const isBottomRow = r === lastGridRow;
          return (
            <div
              key={`time-${r}`}
              ref={i === 0 ? firstTimeCellRef : undefined}
              className="sticky left-0 z-20 border-r bg-white px-2 py-2 text-center text-[12px] font-semibold tabular-nums text-slate-700"
              style={{
                borderRightColor: gridLineColor,
                boxShadow: isBottomRow ? undefined : `inset 0 -1px 0 ${gridLineColor}`,
              }}
            >
              {timeRangeForRow(r)}
            </div>
          );
        })}

        {slots.map((s, idx) => {
          const isBottomRow = s.row === lastGridRow;
          const slotBoxShadow = [
            s.col !== lastCol ? `inset -1px 0 0 ${gridLineColor}` : "",
            !isBottomRow ? `inset 0 -1px 0 ${gridLineColor}` : "",
          ]
            .filter(Boolean)
            .join(", ");
          return (
            <div
              key={`slot-${idx}`}
              className="relative cursor-pointer bg-white"
              style={{
                gridColumn: String(s.col),
                gridRow: String(s.row),
                boxShadow: slotBoxShadow,
              }}
              onClick={(e) => { e.stopPropagation(); openPicker(s.col, s.row); }}
              title="Add task"
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-extrabold opacity-20">+</span>
            </div>
          );
        })}

        {tasks.map(t => {
          const template = templateById.get(t.type);
          return (
            <Block
              key={t.id}
              id={t.id}
              type={t.type}
              label={t.label}
              col={t.col}
              startRow={t.startRow}
              span={t.span}
              color={colorForTask(t)}
              selected={t.id === selected}
              highlighted={emphasizedCol === t.col}
              isFirstCol={t.col === firstEmployeeCol}
              touchesBottomEdge={t.startRow + t.span >= maxRowEx}
              onSelect={() => setSelected(t.id)}
              isLastCol={t.col === lastCol}
              onStartResize={(which, e) => onStartResize(which, t.id, e)}
            />
          );
        })}
      </div>

      <Modal open={!!modal} choices={templates} onClose={closePicker} onPick={createFromPicker} />

        {addOpen && (
          <div
            className="fixed inset-0 z-[2147483647] grid place-items-center bg-black/35 p-4 backdrop-blur-[1px]"
            onClick={() => setAddOpen(false)}
          >
            <div
              className="card w-full max-w-[540px] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-[var(--border)] px-5 py-4">
                <div>
                  <h2 className="text-2xl font-semibold leading-tight text-slate-800">Add employee</h2>
                  <p className="mt-2 text-sm text-slate-600">Pick from saved people.</p>
                </div>
                <button
                  className="grid h-10 w-10 place-items-center rounded-[12px] bg-[var(--surface-subtle)] text-slate-600 transition hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7283f5]/45"
                  onClick={() => setAddOpen(false)}
                  aria-label="Close add employee dialog"
                >
                  <X className="h-[18px] w-[18px]" />
                </button>
              </div>

              <div className="space-y-3 px-5 py-4 text-[14px]">
                <div className="flex items-center justify-between">
                  <label htmlFor="add-employee-search" className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Search
                  </label>
                  <span className="text-[12px] text-slate-500">
                    {filteredPeople.length} result{filteredPeople.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="add-employee-search"
                    type="text"
                    value={employeePickerQuery}
                    onChange={(event) => setEmployeePickerQuery(event.target.value)}
                    placeholder="Search by name or email"
                    autoFocus
                    className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white pl-10 pr-3 text-[14px] text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.02)] outline-none transition focus:border-[rgba(52,77,232,0.45)] focus:ring-2 focus:ring-[rgba(52,77,232,0.14)]"
                  />
                </div>

                <div className="max-h-[280px] overflow-y-auto rounded-[10px] border border-[var(--border)] bg-white">
                  {filteredPeople.length === 0 ? (
                    <div className="px-3 py-3 text-[13px] text-slate-600">
                      {people.length === 0 ? "No saved people yet." : "No people match that search."}
                    </div>
                  ) : (
                    <div className="divide-y divide-[var(--border)]">
                      {filteredPeople.map((person) => {
                        const alreadyAdded =
                          selectedEmployeeIds.has(String(person.id)) ||
                          selectedEmployeeNames.has(person.name.trim().toLowerCase());
                        return (
                          <div
                            key={person.id}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${
                              alreadyAdded
                                ? "bg-emerald-50/45"
                                : "hover:bg-[#f8faff]"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[14px] font-semibold text-slate-800">
                                {person.name}
                              </span>
                              {person.email && <span className="block truncate text-[12px] text-slate-500">{person.email}</span>}
                            </span>
                            {alreadyAdded ? (
                              <button
                                type="button"
                                onClick={() => removeEmployeeFromPicker(person)}
                                className="shrink-0 rounded-full border border-rose-300 bg-rose-100 px-3 py-1 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-200 hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/70"
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => addEmployee(person)}
                                className="shrink-0 rounded-full border border-[#4f58ef] bg-[#4f58ef] px-3 py-1 text-[12px] font-semibold text-white transition hover:bg-[#434cdf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7283f5]/50"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end border-t border-[var(--border)] bg-white px-5 py-3">
                <button className="btn h-9 px-4 text-[13px]" onClick={() => setAddOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <aside className="w-[320px] min-w-[320px] rounded-[16px] border border-[#d7deea] bg-white p-4 shadow-[0_12px_26px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-slate-900">
              <CalendarDays className="h-4 w-4" />
              <h2 className="text-[15px] font-semibold">School Tours</h2>
            </div>
            <p className="mt-1 text-[13px] text-slate-600">
              Imported tours stay saved with this day until you clear them here.
            </p>
          </div>
          {schoolTourCount > 0 && (
            <button
              type="button"
              onClick={clearSchoolTours}
              className="inline-flex h-8 items-center justify-center rounded-[10px] border border-rose-300 px-3 text-[12px] font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              Clear
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-600">
          <Upload className="h-4 w-4" />
          <span>{schoolTourCount} imported tour{schoolTourCount === 1 ? "" : "s"} saved for this day</span>
        </div>
        {schoolTours.length === 0 ? (
          <div className="mt-4 rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-5 text-[13px] text-slate-600">
            Upload a runsheet and the tours will appear here. Reset will not remove them.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {schoolTours.map((tour) => (
              <div key={tour.id} className="rounded-[14px] border border-slate-200 bg-white px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold leading-5 text-slate-900">{tour.schoolName}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] font-medium text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" />
                        {tour.startTime}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {tour.studentCount} students
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSchoolTour(tour.id)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    aria-label={`Remove ${tour.schoolName}`}
                    title="Remove school tour"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
