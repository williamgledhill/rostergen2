"use client";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { X, Settings2, Trash2, Search } from "lucide-react";
import Block from "@/components/Block";
import Modal from "@/components/Modal";
import { TaskTemplate, defaultTaskTemplates } from "@/lib/taskTemplates";
import type { Person } from "@/lib/people";

type Employee = { id: string | number; name: string; startTime?: string; endTime?: string };
type GridTask = {
  id: string | number;
  type: string;
  label: string;
  col: number;
  startRow: number;
  span: number;
  color?: string;
  employeeId?: number;
  locked?: boolean;
  isLocked?: boolean;
  readOnly?: boolean;
};
type HistorySnapshot = {
  employees: Employee[];
  tasks: GridTask[];
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
    if (a[i].id !== b[i].id || a[i].name !== b[i].name) return false;
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
  employees: initialEmployees,
  initialTasks,
  rosterDateId,
  rosterDate,
  hoursStart,
  hoursEnd,
  onExportXLS,
}: {
  employees: Employee[];
  initialTasks: GridTask[];
  rosterDateId: string;
  rosterDate: Date;
  hoursStart?: string;
  hoursEnd?: string;
  onExportXLS: (html: string) => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [tasks, setTasks] = useState<GridTask[]>(initialTasks);
  const [selected, setSelected] = useState<string | number | undefined>();
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [employeeSettingsId, setEmployeeSettingsId] = useState<string | number | null>(null);
  const [employeeSettingsDraft, setEmployeeSettingsDraft] = useState<{ start: string; end: string }>({ start: "", end: "" });
  const [employeeSettingsDirty, setEmployeeSettingsDirty] = useState(false);
  const [employeeSettingsError, setEmployeeSettingsError] = useState("");
  const [drag, setDrag] = useState<null | { id: string | number; which: "top" | "bottom"; y0: number; start0: number; span0: number }>(null);
  const [modal, setModal] = useState<null | { col: number; row: number }>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [employeePickerQuery, setEmployeePickerQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>(defaultTaskTemplates);

  const containerRef = useRef<HTMLDivElement>(null);
  const employeeSettingsRef = useRef<HTMLDivElement>(null);
  const firstTimeCellRef = useRef<HTMLDivElement>(null);
  const prevStartRef = useRef<number | null>(null);
  const prevMaxRef = useRef<number | null>(null);
  const employeesRef = useRef<Employee[]>(initialEmployees);
  const tasksRef = useRef<GridTask[]>(initialTasks);
  const historyPastRef = useRef<HistorySnapshot[]>([]);
  const historyFutureRef = useRef<HistorySnapshot[]>([]);

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
    setRosterState(initialEmployees, initialTasks);
    historyPastRef.current = [];
    historyFutureRef.current = [];
    setSelected(undefined);
    setEmployeeSettingsId(null);
    setEmployeeSettingsError("");
  }, [initialEmployees, initialTasks, rosterDateId, setRosterState]);

  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

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
    fetch("/api/people").then(res => res.ok ? res.json() : []).then(setPeople).catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/task-templates");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!active) return;
        if (Array.isArray(data) && data.length) setTemplates(data);
      } catch (err) {
        console.error(err);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const templateById = useMemo(() => {
    const map = new Map<string, TaskTemplate>();
    templates.forEach((t) => map.set(t.id, t));
    return map;
  }, [templates]);

  const colorForType = useCallback((type: string) => templateById.get(type)?.color || defaultColorByType[type], [templateById]);

  const employeeCols = useMemo(
    () => employees.map((e, idx) => ({ id: e.id, name: e.name, startTime: e.startTime, endTime: e.endTime, col: idx + 2 })),
    [employees]
  );
  const dayKeyLabel = DAY_KEYS[rosterDate.getDay()];
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

  function resolveEmployeeHours(emp: Employee) {
    const overrideStart = parseTimeToMinutes(emp.startTime);
    const overrideEnd = parseTimeToMinutes(emp.endTime);
    if (overrideStart !== null && overrideEnd !== null && overrideStart < overrideEnd) {
      return { start: emp.startTime as string, end: emp.endTime as string, isOff: false, isOverride: true };
    }

    const person =
      peopleById.get(String(emp.id)) ||
      peopleByName.get(String(emp.name || "").toLowerCase());
    const sched = person?.schedule?.[dayKeyLabel];
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
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][rosterDate.getDay()];
    const working = people.filter((p) => p.schedule?.[dow]?.enabled);
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
    if (!employees.length) {
      applyRosterState(employees, []);
      return;
    }

    type TemplateMeta = {
      id: string;
      template: TaskTemplate;
      span: number;
      window: { startRow: number; endRow: number } | null;
      regularTimeRows: number[];
      hasFixedTimes: boolean;
      limitPerDay: number;
      maxPerEmp: number;
      minPerEmp: number;
      mustManned: boolean;
      allowShrink: boolean;
      maxConsecutiveSpan: number;
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

    const getTotal = (templateId: string) => totalsByTemplate.get(templateId) ?? 0;
    const incTotal = (templateId: string) => totalsByTemplate.set(templateId, getTotal(templateId) + 1);

    const getEmpCount = (templateId: string, empId: string | number) =>
      countsByTemplate.get(templateId)?.get(empId) ?? 0;
    const incEmpCount = (templateId: string, empId: string | number) => {
      if (!countsByTemplate.has(templateId)) countsByTemplate.set(templateId, new Map());
      const map = countsByTemplate.get(templateId)!;
      map.set(empId, (map.get(empId) ?? 0) + 1);
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
      const sched = person?.schedule?.[dayKey];
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

    const addTask = (meta: TemplateMeta, col: number, startRow: number, span: number, empId: string | number) => {
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
        employeeId: Number(empId),
      };
      generated.push(task);
      if (!tasksByCol.has(col)) tasksByCol.set(col, []);
      tasksByCol.get(col)!.push(task);
      incEmpCount(meta.id, empId);
      incTotal(meta.id);
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
        window,
        regularTimeRows: Array.from(new Set(regularTimeRows)).sort((a, b) => a - b),
        hasFixedTimes: regularTimes.length > 0,
        limitPerDay,
        maxPerEmp,
        minPerEmp,
        mustManned: !!template.mustManned,
        allowShrink,
        maxConsecutiveSpan,
      };
    };

    const templatesToSchedule = templates
      .filter((t) => t.enabled !== false)
      .filter(templateApplies)
      .map(buildMeta)
      .filter((t): t is TemplateMeta => !!t)
      .sort((a, b) => {
        const priority = (meta: TemplateMeta) => {
          if (meta.mustManned && meta.hasFixedTimes) return 5;
          if (meta.hasFixedTimes) return 4;
          if (meta.minPerEmp > 0) return 3;
          if (meta.mustManned) return 2;
          return 1;
        };
        const aPriority = priority(a);
        const bPriority = priority(b);
        if (aPriority !== bPriority) return bPriority - aPriority;
        return 0;
      });

    if (!templatesToSchedule.length) {
      applyRosterState(employees, []);
      return;
    }

    for (const meta of templatesToSchedule) {
      const window = meta.window;
      if (!window) continue;
      const span = meta.span;
      const limitPerDay = meta.limitPerDay;
      const maxPerEmp = meta.maxPerEmp;
      const minPerEmp = meta.minPerEmp;

      let candidateRows: number[] = [];
      if (meta.regularTimeRows.length > 0) {
        candidateRows = meta.regularTimeRows;
      } else if (meta.mustManned) {
        for (let r = window.startRow; r + span <= window.endRow; r += span) {
          candidateRows.push(r);
        }
      } else {
        for (let r = window.startRow; r + span <= window.endRow; r += 1) {
          candidateRows.push(r);
        }
      }

      if (candidateRows.length === 0) continue;

      if (minPerEmp > 0) {
        for (let empIndex = 0; empIndex < employees.length; empIndex += 1) {
          const emp = employees[empIndex];
          let needed = minPerEmp - getEmpCount(meta.id, emp.id);
          if (needed <= 0) continue;
          const col = employeeColById.get(emp.id) ?? employees.findIndex((e) => e.id === emp.id) + 2;
          let orderedRows = candidateRows;
          if (candidateRows.length > 1) {
            const offset = Math.floor((empIndex / Math.max(1, employees.length)) * candidateRows.length);
            orderedRows = candidateRows.slice(offset).concat(candidateRows.slice(0, offset));
          }
          for (const row of orderedRows) {
            if (getTotal(meta.id) >= limitPerDay) break;
            if (getEmpCount(meta.id, emp.id) >= maxPerEmp) break;
            if (!isFree(col, row, span, emp.id)) continue;
            addTask(meta, col, row, span, emp.id);
            needed -= 1;
            if (needed <= 0) break;
          }
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
          (a, b) => getEmpCount(meta.id, a.id) - getEmpCount(meta.id, b.id)
        );
        const picked = sortedEmployees.find((emp) => {
          if (getEmpCount(meta.id, emp.id) >= maxPerEmp) return false;
          const col = employeeColById.get(emp.id) ?? employees.findIndex((e) => e.id === emp.id) + 2;
          return isFree(col, row, span, emp.id);
        });
        if (!picked) continue;
        const col = employeeColById.get(picked.id) ?? employees.findIndex((e) => e.id === picked.id) + 2;
        addTask(meta, col, row, span, picked.id);
      }
    }

    const flexibleTemplates = templatesToSchedule.filter((t) => !t.hasFixedTimes);
    const fillTemplates = flexibleTemplates.length ? flexibleTemplates : templatesToSchedule;
    const ignoreFixedTimes = flexibleTemplates.length === 0;

    const getSpanForMeta = (
      meta: TemplateMeta,
      row: number,
      endRow: number,
      options: { ignoreLimits: boolean; ignoreWindow: boolean }
    ) => {
      const windowEnd = options.ignoreWindow ? endRow : (meta.window?.endRow ?? endRow);
      const maxEnd = Math.min(endRow, windowEnd, maxRowEx);
      const available = maxEnd - row;
      if (available <= 0) return 0;
      const span = meta.allowShrink ? Math.max(1, Math.min(meta.span, available)) : meta.span;
      return span <= available ? span : 0;
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
          if (!options.ignoreLimits) {
            if (getTotal(meta.id) >= meta.limitPerDay) return null;
            if (getEmpCount(meta.id, empId) >= meta.maxPerEmp) return null;
          }
          const span = getSpanForMeta(meta, row, endRow, options);
          if (!span) return null;
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
        return getTotal(a.meta.id) - getTotal(b.meta.id);
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
        const pickedIgnoreWindow = pickTemplate(row, empId, col, endRow, { ignoreLimits: true, ignoreWindow: true });
        const picked = pickedStrict || pickedRelaxed || pickedIgnoreWindow;
        if (!picked) {
          row = endRow;
          break;
        }
        const span = getSpanForMeta(picked.meta, row, endRow, picked.options);
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

    const ordered = generated.sort((a, b) => (a.col - b.col) || (a.startRow - b.startRow));
    applyRosterState(employees, ordered);
  }, [employees, templates, rosterDate, colorForType, maxRowEx, rowFromTime, people, applyRosterState]);

  const saveRoster = useCallback(async () => {
    try {
      const res = await fetch("/api/rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: rosterDateId, employees, tasks, hoursStart, hoursEnd }),
      });
      if (!res.ok) {
        console.error("Save failed", await res.text());
        alert("Failed to save roster");
        return;
      }
      alert("Roster saved");
    } catch (err) {
      console.error(err);
      alert("Failed to save roster");
    }
  }, [employees, tasks, rosterDateId, hoursStart, hoursEnd]);

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
    const handler = () => { setAddOpen(true); };
    window.addEventListener("roster:add-employee", handler);
    return () => window.removeEventListener("roster:add-employee", handler);
  }, []);

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
          const bg = task.color || colorForType(task.type) || "#d3e6d5";
          const template = templateById.get(task.type);
          const waitingRowsRaw = Math.max(0, Math.round((template?.waitingMinutes || 0) / 15));
          const packingRowsRaw = Math.max(0, Math.round((template?.packingMinutes || 0) / 15));
          const waitingRows = Math.min(waitingRowsRaw, Math.max(0, task.span - 1));
          const packingRows = Math.min(packingRowsRaw, Math.max(0, task.span - 1 - waitingRows));
          const mainRows = Math.max(1, task.span - waitingRows - packingRows);
          const segStyle =
            "display:flex;align-items:center;justify-content:center;padding:4px 2px;font-weight:600;font-size:12px;font-family:Arial, sans-serif;text-align:center;";
          const segments: string[] = [];
          if (waitingRows > 0) {
            segments.push(
              `<div style="${segStyle}border-bottom:1px solid ${border};">Waiting for</div>`
            );
          }
          segments.push(
            `<div style="${segStyle}${waitingRows > 0 ? `border-top:1px solid ${border};` : ""}${packingRows > 0 ? `border-bottom:1px solid ${border};` : ""}">${task.label}</div>`
          );
          if (packingRows > 0) {
            segments.push(
              `<div style="${segStyle}border-top:1px solid ${border};">Packing up</div>`
            );
          }
          const inner = segments.length
            ? `<div style="display:flex;flex-direction:column;justify-content:center;height:100%;">${segments.join("")}</div>`
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
    onExportXLS(html);
  }, [employeeCols, tasks, onExportXLS, colorForType, timeRangeForSpan, maxRowEx, dayStartMin, dayEndMin, rosterDate, getEmployeeHoursLabel, templateById]);

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
      { id, type: cls, label, col: modal.col, startRow: modal.row, span: 1, color: template.color },
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
  const lastCol = employeeCols[employeeCols.length - 1]?.col;
  const selectedTaskCol = tasks.find((t) => t.id === selected)?.col ?? null;
  const emphasizedCol = hoveredCol ?? selectedTaskCol;

  return (
    <div className="w-full overflow-x-auto">
      <div
        ref={containerRef}
        className="card p-0 inline-block overflow-hidden"
        style={{ borderBottomWidth: 0 }}
        onClick={() => setSelected(undefined)}
      >
      {/* grid */}
      <div
        className="grid inline-grid"
        style={{
          gridTemplateColumns: `var(--timew) repeat(${employees.length}, var(--empw))`,
          gridTemplateRows: "68px",
          gridAutoRows: "var(--rowh)",
        }}
      >
        <div className="sticky left-0 z-40 rounded-tl-[12px] border-b border-r bg-[var(--surface-subtle)] px-3 py-1.5 text-center shadow-[inset_0_-1px_0_rgba(15,23,42,0.08)]">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">Time</span>
        </div>
        {employeeCols.map((h) => {
          const highlighted = emphasizedCol === h.col;
          const resolved = resolveEmployeeHours(h);
          const hoursLabel = resolved.isOff ? "Off" : `${resolved.start} - ${resolved.end}`;
          return (
            <div
              key={h.id}
              className={`group relative border-b ${h.col === lastCol ? "rounded-tr-[12px]" : "border-r"} px-3 py-1.5 transition ${
                highlighted ? "bg-[#eef2ff]" : "bg-[var(--surface-subtle)]"
              }`}
              onMouseEnter={() => setHoveredCol(h.col)}
              onMouseLeave={() => setHoveredCol((current) => (current === h.col ? null : current))}
            >
              <button
                className="absolute right-2 top-1.5 grid h-7 w-7 place-items-center rounded-md border border-[#d6dcea] bg-white text-slate-500 shadow-sm transition hover:border-[#b9c7e6] hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7283f5]/45"
                onClick={(e) => {
                  e.stopPropagation();
                  openEmployeeSettings({ id: h.id, name: h.name, startTime: h.startTime, endTime: h.endTime });
                }}
                title={`Settings for ${h.name}`}
                aria-label={`Settings for ${h.name}`}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
              <div className="flex h-full flex-col items-start justify-center pr-10">
                <span className="max-w-full truncate text-[15px] font-semibold leading-tight tracking-[0.01em] text-slate-900">
                  {h.name}
                </span>
                <span className={`mt-0.5 text-[12px] font-medium tabular-nums ${resolved.isOff ? "italic text-slate-500" : "text-slate-600"}`}>
                  {hoursLabel}
                </span>
              </div>
              {employeeSettingsId === h.id && (
                <div
                  ref={employeeSettingsRef}
                  className="absolute right-2 top-9 z-50 w-[280px] max-w-[calc(100vw-1.5rem)] rounded-[10px] border border-[var(--border)] bg-white p-3 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="mb-2">
                    <p className="text-[13px] font-semibold text-slate-800">{h.name}</p>
                    <p className="text-[11px] text-slate-500">Day time override</p>
                  </div>
                  <div className="space-y-2">
                    <div>
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
                    <div>
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
                      className="btn h-8 justify-center gap-1 border-red-200 bg-red-50 text-[12px] text-red-700 hover:bg-red-100"
                      onClick={() => {
                        setEmployeeSettingsId(null);
                        setEmployeeSettingsDirty(false);
                        setEmployeeSettingsError("");
                        removeEmployee(h.id);
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
          return (
            <div
              key={`time-${r}`}
              ref={i === 0 ? firstTimeCellRef : undefined}
              className="sticky left-0 z-10 border-b border-r bg-[#f8f9fc] px-2 py-2 text-center text-[12px] font-semibold tabular-nums text-slate-700"
            >
              {timeRangeForRow(r)}
            </div>
          );
        })}

        {slots.map((s, idx) => {
          const highlighted = emphasizedCol === s.col;
          return (
            <div
              key={`slot-${idx}`}
              className={`relative cursor-pointer border-b ${s.col === lastCol ? "" : "border-r"} ${
                highlighted ? "bg-[#eef2ff]/55" : ""
              } hover:bg-slate-50`}
              style={{ gridColumn: String(s.col), gridRow: String(s.row) }}
              onClick={(e) => { e.stopPropagation(); openPicker(s.col, s.row); }}
              title="Add task"
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-extrabold opacity-25">+</span>
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
              color={t.color || colorForType(t.type)}
              waitingMinutes={template?.waitingMinutes}
              packingMinutes={template?.packingMinutes}
              selected={t.id === selected}
              highlighted={emphasizedCol === t.col}
              onSelect={() => setSelected(t.id)}
              isLastCol={t.col === lastCol}
              onStartResize={(which, e) => onStartResize(which, t.id, e)}
            />
          );
        })}
      </div>

      <Modal open={!!modal} onClose={closePicker} onPick={createFromPicker} />

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
                  className="grid h-10 w-10 place-items-center rounded-[12px] border border-[var(--border)] bg-[var(--surface-subtle)] text-slate-600 transition hover:bg-white hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7283f5]/45"
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
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
