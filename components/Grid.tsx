"use client";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { X, Trash2, Search, Settings2 } from "lucide-react";
import Block from "@/components/Block";
import Modal from "@/components/Modal";
import { AutosaveState, readDraftRecord, writeDraftRecord } from "@/lib/clientDrafts";
import { buildEditorDraftStorageKey } from "@/lib/editorPersistence";
import {
  TASK_TEMPLATE_REFRESH_EVENT,
  TASK_TEMPLATE_REFRESH_STORAGE_KEY,
  TaskTemplate,
  defaultTaskTemplates,
} from "@/lib/taskTemplates";
import { getDayScheduleForDate, type Person } from "@/lib/people";
import {
  clipTaskAroundBlockedRange,
  compareFutureMinimumAvailability,
  getFeasiblePlacementRows,
  getAutofillTemplatePriority,
  getPreferredConcurrentLimit,
} from "@/lib/rosterAutofill";

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
type HistorySnapshot = {
  employees: Employee[];
  tasks: GridTask[];
};

type RosterDraftValue = {
  employees: Employee[];
  tasks: GridTask[];
  hoursStart?: string;
  hoursEnd?: string;
};

export type RosterSaveState = AutosaveState;
export type AutofillNotice = {
  title: string;
  messages: string[];
};

const MIN_ROW = 2;
const DEFAULT_START_MIN = 9 * 60 + 30;
const DEFAULT_END_MIN = 16 * 60;
const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_HISTORY_ENTRIES = 100;
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

function buildRosterSaveSignature(
  employeeList: Employee[],
  taskList: GridTask[],
  hoursStart?: string,
  hoursEnd?: string,
  rosterDateId?: string
) {
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
    tasks: taskList.map((task) => ({
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

const typeToClassLabel: Record<string, [string, string]> = {
  front: ["front", "Front Desk"],
  tour: ["tour", "Public Tour"],
  prep: ["prep", "Prep"],
  gallery: ["gallery", "Gallery"],
  break: ["break", "Break"],
  tidy: ["tidy", "Finish"],
  "school-pre": ["prep", "School Pre"],
  "school-program": ["tour", "School Program"],
};

const defaultColorByType: Record<string, string> = Object.fromEntries(
  defaultTaskTemplates.map((t) => [t.id, t.color || "#d3e6d5"])
);

export default function Grid({
  toolbar,
  employees: initialEmployees,
  initialTasks,
  rosterDateId,
  rosterDate,
  hoursStart,
  hoursEnd,
  initialSavedAt,
  onExportXLS,
  onSaveStateChange,
  onAutofillNoticeChange,
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
  onExportXLS: (html: string, fileName: string) => void;
  onSaveStateChange?: (state: RosterSaveState) => void;
  onAutofillNoticeChange?: (notice: AutofillNotice | null) => void;
  onRestoreDraftHours?: (hours: { start: string; end: string }) => void;
  people?: Person[];
  templates?: TaskTemplate[];
}) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [tasks, setTasks] = useState<GridTask[]>(initialTasks);
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
  const tasksRef = useRef<GridTask[]>(initialTasks);
  const hoursRef = useRef<{ start?: string; end?: string }>({ start: hoursStart, end: hoursEnd });
  const historyPastRef = useRef<HistorySnapshot[]>([]);
  const historyFutureRef = useRef<HistorySnapshot[]>([]);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const queuedSaveModeRef = useRef<"autosave" | "manual" | null>(null);
  const saveCycleRef = useRef(0);
  const autofillRunRef = useRef(0);
  const suspendDraftEffectsRef = useRef(true);
  const lastSavedAtRef = useRef(initialSavedAt);
  const lastSavedSignatureRef = useRef(
    buildRosterSaveSignature(initialEmployees, initialTasks, hoursStart, hoursEnd, rosterDateId)
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
      tasks: cloneTasks(initialTasks),
      hoursStart,
      hoursEnd,
    };
    const serverSignature = buildRosterSaveSignature(
      serverDraftValue.employees,
      serverDraftValue.tasks,
      serverDraftValue.hoursStart,
      serverDraftValue.hoursEnd,
      rosterDateId
    );
    const persistedDraft = readDraftRecord<RosterDraftValue>(draftStorageKey);
    const persistedValue = persistedDraft?.value ?? serverDraftValue;
    const persistedSignature = buildRosterSaveSignature(
      persistedValue.employees,
      persistedValue.tasks,
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
    historyPastRef.current = [];
    historyFutureRef.current = [];
    setSelected(undefined);
    setEmployeeSettingsId(null);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    autofillRunRef.current = 0;
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
    hoursRef.current = { start: hoursStart, end: hoursEnd };
  }, [hoursStart, hoursEnd]);

  useEffect(() => {
    if (suspendDraftEffectsRef.current) return;
    writeDraftRecord<RosterDraftValue>(draftStorageKey, {
      value: {
        employees: cloneEmployees(employees),
        tasks: cloneTasks(tasks),
        hoursStart,
        hoursEnd,
      },
      lastSavedSignature: lastSavedSignatureRef.current,
      savedAt: lastSavedAtRef.current,
    });
  }, [draftStorageKey, employees, hoursEnd, hoursStart, tasks]);

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

  const colorForType = useCallback((type: string) => templateById.get(type)?.color || defaultColorByType[type], [templateById]);
  const colorForTask = useCallback(
    (task: Pick<GridTask, "type" | "color">) =>
      templateById.get(task.type)?.color || task.color || defaultColorByType[task.type],
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

  const autofill = useCallback(() => {
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
      overrides?: { waitingMinutes?: number; packingMinutes?: number }
    ) => {
      const id = crypto.randomUUID?.() ?? String(Math.random());
      const label = meta.template.name || "Task";
      const type = meta.template.id || label;
      const task: GridTask = {
        id,
        type,
        label,
        col,
        startRow,
        span,
        color: meta.template.color || colorForType(type),
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

    const getSpanForMeta = (
      meta: TemplateMeta,
      row: number,
      endRow: number,
      options: { ignoreWindow: boolean }
    ) => {
      const windowEnd = options.ignoreWindow ? endRow : (meta.window?.endRow ?? endRow);
      const maxEnd = Math.min(endRow, windowEnd, maxRowEx);
      const available = maxEnd - row;
      if (available <= 0) return 0;
      const span = meta.allowShrink ? Math.max(1, Math.min(meta.span, available)) : meta.span;
      return span <= available ? span : 0;
    };

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
      const days = Array.isArray(template.regularDays) ? template.regularDays : [];
      return days.length === 0 || days.includes(dayKey);
    };

    const buildMeta = (template: TaskTemplate): TemplateMeta | null => {
      const window = getWindow(template);
      if (!window) return null;
      const hasDuration = Number.isFinite(template.durationMinutes) && (template.durationMinutes ?? 0) > 0;
      const baseDuration = hasDuration
        ? (template.durationMinutes as number)
        : (template.id === "front" || template.id === "gallery" ? 30 : 60);
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
      const dayTimes = Array.isArray(regularTimesByDay?.[dayKey])
        ? regularTimesByDay[dayKey]
        : [];
      const regularTimes = dayTimes.length > 0
        ? dayTimes
        : (Array.isArray(template.regularTimes) ? template.regularTimes : []);
      const regularTimeRows = regularTimes
        .map((t) => {
          const mainRow = rowFromTime(t, "floor");
          if (mainRow === null) return null;
          return mainRow - waitingRows;
        })
        .filter((r): r is number => r !== null)
        .filter((r) => r >= window.startRow && r + span <= window.endRow);
      return {
        id: template.id || template.name || "task",
        template,
        span,
        waitingMinutes,
        packingMinutes,
        window,
        regularTimeRows: Array.from(new Set(regularTimeRows)).sort((a, b) => a - b),
        hasFixedTimes: regularTimes.length > 0,
        limitPerDay,
        maxPerEmp,
        minPerEmp,
        mustManned: !!template.mustManned,
        overwriteExistingTasks: !!template.overwriteExistingTasks,
        attendedByAll: !!template.attendedByAll,
        allowShrink,
        maxConsecutiveSpan,
        maxConcurrentPerTimeslot,
      };
    };

    const getCandidateRowsForMeta = (meta: TemplateMeta) => {
      if (!meta.window) return [];
      if (meta.regularTimeRows.length > 0) return meta.regularTimeRows;

      const rows: number[] = [];
      for (let row = meta.window.startRow; row + meta.span <= meta.window.endRow; row += 1) {
        rows.push(row);
      }
      return rows;
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

    const pickEmployeeForPlacement = (
      meta: TemplateMeta,
      row: number,
      span: number,
      futureMinimumMetas: TemplateMeta[] = []
    ) => {
      const blockedRange = { startRow: row, span };
      const futureAvailabilityByEmployee = new Map<string | number, number[]>();
      const getFutureAvailability = (emp: Employee) => {
        if (!futureAvailabilityByEmployee.has(emp.id)) {
          futureAvailabilityByEmployee.set(
            emp.id,
            getFutureMinimumAvailabilityCounts(emp, blockedRange, futureMinimumMetas)
          );
        }
        return futureAvailabilityByEmployee.get(emp.id) ?? [];
      };

      const feasibleEmployees = employees.filter((emp) => {
        if (getEmpCount(meta.id, emp.id) >= meta.maxPerEmp) return false;
        const col = employeeColById.get(emp.id) ?? employees.findIndex((e) => e.id === emp.id) + 2;
        return (
          isFree(col, row, span, emp.id) &&
          !exceedsConcurrentLimit(meta.id, row, span, meta.maxConcurrentPerTimeslot)
        );
      });

      feasibleEmployees.sort((a, b) => {
        const futureDiff = compareFutureMinimumAvailability(
          getFutureAvailability(a),
          getFutureAvailability(b)
        );
        if (futureDiff !== 0) return futureDiff;

        const countDiff = getEmpCount(meta.id, a.id) - getEmpCount(meta.id, b.id);
        if (countDiff !== 0) return countDiff;
        return (
          getRotatedRank(employeeOrder.get(a.id) ?? 0, employees.length, autofillVariant) -
          getRotatedRank(employeeOrder.get(b.id) ?? 0, employees.length, autofillVariant)
        );
      });

      return feasibleEmployees[0];
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
      (meta) => meta.attendedByAll || meta.overwriteExistingTasks
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
            !exceedsConcurrentLimit(meta.id, row, span, concurrentLimit)
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

    const assignMinimumsForMeta = (meta: TemplateMeta, candidateRows: number[]) => {
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

        for (const row of bestRows) {
          const span = getSpanForMeta(meta, row, meta.window?.endRow ?? maxRowEx, { ignoreWindow: false });
          if (!span) continue;
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

    for (const [metaIndex, meta] of templatesForPrimaryPass.entries()) {
      const window = meta.window;
      if (!window) continue;
      const span = meta.span;
      const limitPerDay = meta.limitPerDay;
      const maxPerEmp = meta.maxPerEmp;
      const minPerEmp = meta.minPerEmp;

      if (meta.mustManned) {
        const futureMinimumMetas = templatesForPrimaryPass
          .slice(metaIndex + 1)
          .filter((candidate) => !candidate.mustManned && candidate.minPerEmp > 0);
        const requiredRows =
          meta.regularTimeRows.length > 0
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
                        !exceedsConcurrentLimit(meta.id, a, spanA, meta.maxConcurrentPerTimeslot)
                      );
                    }).length
                  : Number.POSITIVE_INFINITY;
                const feasibleB = spanB
                  ? employees.filter((emp) => {
                      if (getEmpCount(meta.id, emp.id) >= meta.maxPerEmp) return false;
                      const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
                      return (
                        isFree(col, b, spanB, emp.id) &&
                        !exceedsConcurrentLimit(meta.id, b, spanB, meta.maxConcurrentPerTimeslot)
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
          const picked = pickEmployeeForPlacement(meta, row, requiredSpan, futureMinimumMetas);
          if (!picked) continue;
          const col = employeeColById.get(picked.id) ?? employees.findIndex((e) => e.id === picked.id) + 2;
          addTask(meta, col, row, requiredSpan, picked.id);
        }
        continue;
      }

      let candidateRows: number[] = [];
      if (meta.regularTimeRows.length > 0) {
        candidateRows = meta.regularTimeRows;
      } else {
        for (let r = window.startRow; r + span <= window.endRow; r += 1) {
          candidateRows.push(r);
        }
      }

      if (candidateRows.length === 0) continue;

      if (minPerEmp > 0) {
        const minimumsSatisfied = assignMinimumsForMeta(meta, candidateRows);
        if (!minimumsSatisfied) {
          const unmetEmployees = employees
            .filter((emp) => getEmpCount(meta.id, emp.id) < minPerEmp)
            .map((emp) => emp.name);
          if (unmetEmployees.length) {
            unmetMinimums.push(`${meta.template.name}: ${unmetEmployees.join(", ")}`);
          }
          continue;
        }
      }

      let desiredCount = 1;
      if (meta.regularTimeRows.length > 0 || meta.mustManned) {
        desiredCount = candidateRows.length;
      } else if (Number.isFinite(meta.template.limitPerDay) && (meta.template.limitPerDay ?? 0) > 0) {
        desiredCount = meta.template.limitPerDay as number;
      } else if (minPerEmp > 0) {
        desiredCount = minPerEmp * employees.length;
      }
      desiredCount = Math.min(desiredCount, limitPerDay);

      for (const row of candidateRows) {
        if (getTotal(meta.id) >= desiredCount) break;
        if (getTotal(meta.id) >= limitPerDay) break;

        const sortedEmployees = [...employees].sort(
          (a, b) => {
            const countDiff = getEmpCount(meta.id, a.id) - getEmpCount(meta.id, b.id);
            if (countDiff !== 0) return countDiff;
            return (
              getRotatedRank(employeeOrder.get(a.id) ?? 0, employees.length, autofillVariant) -
              getRotatedRank(employeeOrder.get(b.id) ?? 0, employees.length, autofillVariant)
            );
          }
        );
        const picked = sortedEmployees.find((emp) => {
          if (getEmpCount(meta.id, emp.id) >= maxPerEmp) return false;
          const col = employeeColById.get(emp.id) ?? employees.findIndex((e) => e.id === emp.id) + 2;
          return (
            isFree(col, row, span, emp.id) &&
            !exceedsConcurrentLimit(meta.id, row, span, meta.maxConcurrentPerTimeslot)
          );
        });
        if (!picked) continue;
        const col = employeeColById.get(picked.id) ?? employees.findIndex((e) => e.id === picked.id) + 2;
        addTask(meta, col, row, span, picked.id);
      }
    }

    const flexibleTemplates = templatesForPrimaryPass.filter((t) => !t.hasFixedTimes);
    const fillTemplates = flexibleTemplates.length ? flexibleTemplates : templatesForPrimaryPass;
    const ignoreFixedTimes = flexibleTemplates.length === 0;

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

    const pickTemplate = (
      row: number,
      empId: string | number,
      col: number,
      endRow: number,
      options: { ignoreLimits: boolean; ignoreWindow: boolean }
    ) => {
      const candidates = fillTemplates
        .map((meta) => {
          if (!options.ignoreWindow && meta.window) {
            if (row < meta.window.startRow || row >= meta.window.endRow) return null;
          }
          if (!ignoreFixedTimes && meta.hasFixedTimes) {
            if (!meta.regularTimeRows.includes(row)) return null;
          }
          if (getTotal(meta.id) >= meta.limitPerDay) return null;
          if (!options.ignoreLimits) {
            if (getEmpCount(meta.id, empId) >= meta.maxPerEmp) return null;
          }
          const span = getSpanForMeta(meta, row, endRow, { ignoreWindow: options.ignoreWindow });
          if (!span) return null;
          if (exceedsConcurrentLimit(meta.id, row, span, meta.maxConcurrentPerTimeslot)) return null;
          const exceedsConsecutive =
            meta.maxConsecutiveSpan > 0 &&
            getConsecutiveSpan(col, meta.id, row, span) > meta.maxConsecutiveSpan;
          return { meta, exceedsConsecutive };
        })
        .filter((c): c is { meta: TemplateMeta; exceedsConsecutive: boolean } => !!c);
      if (!candidates.length) return null;
      const preferred = candidates.some((c) => !c.exceedsConsecutive)
        ? candidates.filter((c) => !c.exceedsConsecutive)
        : candidates;
      preferred.sort((a, b) => {
        const aEmp = getEmpCount(a.meta.id, empId);
        const bEmp = getEmpCount(b.meta.id, empId);
        if (aEmp !== bEmp) return aEmp - bEmp;
        const totalDiff = getTotal(a.meta.id) - getTotal(b.meta.id);
        if (totalDiff !== 0) return totalDiff;
        return a.meta.id.localeCompare(b.meta.id);
      });
      return { meta: preferred[0].meta, options };
    };

    const fillGap = (col: number, empId: string | number, startRow: number, endRow: number) => {
      let row = startRow;
      while (row < endRow) {
        if (!isFree(col, row, 1, empId)) {
          row += 1;
          continue;
        }
        const pickedStrict = pickTemplate(row, empId, col, endRow, { ignoreLimits: false, ignoreWindow: false });
        const pickedRelaxed = pickTemplate(row, empId, col, endRow, { ignoreLimits: true, ignoreWindow: false });
        const picked = pickedStrict || pickedRelaxed;
        if (!picked) {
          row = endRow;
          break;
        }
        const span = getSpanForMeta(picked.meta, row, endRow, { ignoreWindow: picked.options.ignoreWindow });
        if (!span) {
          row += 1;
          continue;
        }
        addTask(picked.meta, col, row, span, empId);
        row += span;
      }
    };

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

    const getDesiredPlacements = (meta: TemplateMeta, candidateRows: number[]) => {
      let desiredCount = 1;
      if (meta.regularTimeRows.length > 0 || meta.mustManned) {
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
      if (meta.overwriteExistingTasks) {
        clipConflictsInColumn(col, row, span);
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

        const picked = sortedEmployees.find((emp) => {
          const col = employeeColById.get(emp.id) ?? employees.findIndex((entry) => entry.id === emp.id) + 2;
          return meta.overwriteExistingTasks || isFree(col, row, span, emp.id);
        });
        if (!picked) continue;

        const col = employeeColById.get(picked.id) ?? employees.findIndex((entry) => entry.id === picked.id) + 2;
        placeFinalTask(meta, col, row, span, picked.id);
      }
    };

    finalPassTemplates.forEach((meta) => {
      if (meta.attendedByAll) {
        scheduleAttendedByAllMeta(meta);
        return;
      }
      scheduleOverrideMeta(meta);
    });

    const unmetCoverage = templatesForPrimaryPass
      .filter((meta) => meta.mustManned && meta.window)
      .flatMap((meta) => {
        const window = meta.window!;
        if (meta.regularTimeRows.length > 0) {
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
    onAutofillNoticeChange?.(
      alertMessages.length
        ? {
            title: "Autofill note",
            messages: alertMessages,
          }
        : null
    );
  }, [employees, templates, rosterDate, colorForType, maxRowEx, rowFromTime, people, applyRosterState, onAutofillNoticeChange]);

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
    const snapshotHours = { ...hoursRef.current };
    const nextSignature = buildRosterSaveSignature(
      snapshotEmployees,
      snapshotTasks,
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
          tasks: snapshotTasks,
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
  }, [employees, tasks, hoursStart, hoursEnd, rosterDateId, saveRoster, onSaveStateChange]);

  useEffect(() => {
    const flushAutosave = () => {
      const nextSignature = buildRosterSaveSignature(
        employeesRef.current,
        tasksRef.current,
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
    const handler = () => autofill();
    window.addEventListener("roster-autofill", handler);
    return () => window.removeEventListener("roster-autofill", handler);
  }, [autofill]);

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
          const template = templateById.get(task.type);
          const waitingRowsRaw = Math.max(0, Math.round(((task.waitingMinutes ?? template?.waitingMinutes) || 0) / 15));
          const packingRowsRaw = Math.max(0, Math.round(((task.packingMinutes ?? template?.packingMinutes) || 0) / 15));
          const waitingRows = Math.min(waitingRowsRaw, Math.max(0, task.span - 1));
          const packingRows = Math.min(packingRowsRaw, Math.max(0, task.span - 1 - waitingRows));
          const mainRows = Math.max(1, task.span - waitingRows - packingRows);
          const segStyle =
            `padding:4px 2px;font-weight:600;font-size:12px;font-family:Arial, sans-serif;text-align:center;vertical-align:middle;background:${bg};`;
          const segments: string[] = [];
          if (waitingRows > 0) {
            segments.push(
              `<tr><td style="${segStyle}height:${(waitingRows / task.span) * 100}%;border-bottom:1px solid ${border};">Waiting for</td></tr>`
            );
          }
          segments.push(
            `<tr><td style="${segStyle}height:${(mainRows / task.span) * 100}%;${packingRows > 0 ? `border-bottom:1px solid ${border};` : ""}">${task.label}</td></tr>`
          );
          if (packingRows > 0) {
            segments.push(
              `<tr><td style="${segStyle}height:${(packingRows / task.span) * 100}%;">Packing up</td></tr>`
            );
          }
          const inner = segments.length
            ? `<table style="width:100%;height:100%;border-collapse:collapse;table-layout:fixed;"><tbody>${segments.join("")}</tbody></table>`
            : task.label;
          rowHtml += `<td class="task-cell" rowspan="${task.span}" style="background:${bg}; font-weight:600; text-align:center; border:1px solid ${border};">${inner}</td>`;
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
    onExportXLS(html, fileName);
  }, [employeeCols, tasks, onExportXLS, colorForTask, timeRangeForSpan, maxRowEx, dayStartMin, dayEndMin, rosterDate, getEmployeeHoursLabel, templateById]);

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
    const fallback = typeToClassLabel[template?.id || ""] || [];
    const cls = fallback[0] || template?.id || "gallery";
    const label = fallback[1] || template?.name || "Task";
    const id = crypto.randomUUID?.() ?? String(Math.random());
    const nextTasks = [
      ...tasksRef.current,
      {
        id,
        type: cls,
        label,
        col: modal.col,
        startRow: modal.row,
        span: 1,
        color: template.color,
        waitingMinutes: template.waitingMinutes || 0,
        packingMinutes: template.packingMinutes || 0,
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

  return (
    <div className="w-full overflow-x-auto">
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
          className={`sticky left-0 z-40 border-r bg-white px-3 py-1.5 text-center ${hasToolbar ? "" : "rounded-tl-[12px]"}`}
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
              className={`group relative bg-white px-3 py-1.5 transition ${column.col === lastCol && !hasToolbar ? "rounded-tr-[12px]" : ""}`}
              style={{
                boxShadow: `${column.col === lastCol ? "" : `inset -1px 0 0 ${gridLineColor}, `}inset 0 -1px 0 ${gridLineColor}`,
              }}
            >
              <div className="min-w-0 py-0.5 pr-10">
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
              waitingMinutes={t.waitingMinutes ?? template?.waitingMinutes}
              packingMinutes={t.packingMinutes ?? template?.packingMinutes}
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
    </div>
  );
}
