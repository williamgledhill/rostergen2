"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Save, Trash2 } from "lucide-react";
import { buildDraftStorageKey, formatAutosaveStatusText, getAutosaveStatusClassName, removeDraftRecord } from "@/lib/clientDrafts";
import { navigateWithinSpa, shouldHandleSpaClick } from "@/lib/spaNavigation";
import { getAutofillTaskRole } from "@/lib/rosterAutofill";
import { invalidateWorkspaceResource, taskDataKey, writeCachedResource } from "@/lib/workspaceData";
import {
  TASK_TEMPLATE_DELETED_STORAGE_KEY,
  TASK_TEMPLATE_REFRESH_EVENT,
  TASK_TEMPLATE_REFRESH_STORAGE_KEY,
  type TaskTemplate,
} from "@/lib/taskTemplates";
import { usePersistedAutosave } from "@/lib/usePersistedAutosave";

const REGULAR_DAYS = [
  { key: "Mon", label: "Monday" },
  { key: "Tue", label: "Tuesday" },
  { key: "Wed", label: "Wednesday" },
  { key: "Thu", label: "Thursday" },
  { key: "Fri", label: "Friday" },
  { key: "Sat", label: "Saturday" },
  { key: "Sun", label: "Sunday" },
];

const DURATION_OPTIONS = Array.from({ length: 16 }, (_, idx) => (idx + 1) * 15);

const AUTOFILL_ROLE_META = {
  coverage: {
    label: "Required coverage",
    description: "Autofill treats this as a hard coverage rule and rotates people around stricter caps where possible.",
    accent: "border-amber-200 bg-amber-50 text-amber-900",
  },
  minimum: {
    label: "Per-person minimum",
    description: "Autofill reserves this for each employee before it fills generic work, so breaks and lunches keep their space.",
    accent: "border-rose-200 bg-rose-50 text-rose-900",
  },
  fixed: {
    label: "Timed task",
    description: "Autofill places this into its configured windows or slots before generic filler work.",
    accent: "border-sky-200 bg-sky-50 text-sky-900",
  },
  filler: {
    label: "Gap filler",
    description: "Autofill uses this only after hard rules are satisfied, and it stops instead of breaking caps.",
    accent: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  override: {
    label: "Override task",
    description: "Autofill runs this late and only replaces tasks that are allowed to move out of the way.",
    accent: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
  },
  attended: {
    label: "All-staff block",
    description: "Everyone working in that slot gets this task together, so it behaves like a shared event block.",
    accent: "border-violet-200 bg-violet-50 text-violet-900",
  },
} as const;

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5">
        <h2 className="text-[18px] font-bold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] font-medium text-slate-600">{description}</p> : null}
      </div>
      <div className="p-3.5 sm:p-4">{children}</div>
    </section>
  );
}

function FieldBlock({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="block text-[14px] font-semibold text-slate-900">{label}</label>
      {children}
      {hint ? <p className="text-[12px] font-medium leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[14px] font-semibold text-slate-900">
          {label}
        </label>
        <p className="mt-0.5 text-[13px] font-medium leading-5 text-slate-600">{description}</p>
      </div>
      <label htmlFor={id} className="relative inline-flex cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-[#675dff]" />
        <span className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </label>
    </div>
  );
}

function SlotChip({
  label,
  removeLabel,
  onRemove,
}: {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 text-[13px] font-medium text-slate-700">
      <span>{label}</span>
      <button
        type="button"
        className="text-[12px] font-semibold text-slate-500 transition hover:text-slate-800"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        x
      </button>
    </span>
  );
}

export default function TaskDetailClient({ id, initialTask }: { id: string; initialTask: TaskTemplate | null }) {
  const router = useRouter();
  const initialTaskValue = useMemo(() => initialTask, [initialTask]);
  const {
    value: task,
    setValue: setTask,
    saveState,
    saveNow,
  } = usePersistedAutosave<TaskTemplate | null>({
    storageKey: buildDraftStorageKey("task", id),
    initialValue: initialTaskValue,
    getSignature: (value) => JSON.stringify(value),
    save: async (value, { keepalive, mode }) => {
      if (!value) return;
      const res = await fetch("/api/task-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
        keepalive,
      });
      if (!res.ok) throw new Error("Failed to save");
      const saved = (await res.json()) as TaskTemplate;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TASK_TEMPLATE_REFRESH_EVENT));
        try {
          window.localStorage.setItem(TASK_TEMPLATE_REFRESH_STORAGE_KEY, new Date().toISOString());
        } catch (error) {
          console.error(error);
        }
      }
      if (mode === "manual") {
        router.refresh();
      }
      writeCachedResource(taskDataKey(id), saved);
      invalidateWorkspaceResource("tasks");
      return {
        value: saved,
        savedAt: new Date().toISOString(),
      };
    },
  });
  const [newTimeSlot, setNewTimeSlot] = useState("");
  const [newDayTimeSlots, setNewDayTimeSlots] = useState<Record<string, string>>({});

  useEffect(() => {
    setNewTimeSlot("");
    setNewDayTimeSlots({});
  }, [initialTask, id]);

  function toggleRegularDay(dayKey: string) {
    setTask((t) => {
      if (!t) return t;
      const current = Array.isArray(t.regularDays) ? t.regularDays : [];
      const next = new Set(current);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return { ...t, regularDays: Array.from(next) };
    });
  }

  function updateDayWindow(dayKey: string, field: "start" | "end", value: string) {
    setTask((t) => {
      if (!t) return t;
      const current = t.regularDayWindows && typeof t.regularDayWindows === "object" ? t.regularDayWindows : {};
      const dayWindow = current[dayKey] || {};
      return { ...t, regularDayWindows: { ...current, [dayKey]: { ...dayWindow, [field]: value } } };
    });
  }

  function toggleAllDays(checked: boolean) {
    setTask((t) => (t ? { ...t, regularDays: checked ? REGULAR_DAYS.map((d) => d.key) : [] } : t));
  }

  function addTimeSlot() {
    if (!newTimeSlot) return;
    setTask((t) => {
      if (!t) return t;
      const current = Array.isArray(t.regularTimes) ? t.regularTimes : [];
      return { ...t, regularTimes: Array.from(new Set([...current, newTimeSlot])).sort() };
    });
    setNewTimeSlot("");
  }

  function removeTimeSlot(slot: string) {
    setTask((t) => {
      if (!t) return t;
      const current = Array.isArray(t.regularTimes) ? t.regularTimes : [];
      return { ...t, regularTimes: current.filter((s) => s !== slot) };
    });
  }

  function addDayTimeSlot(dayKey: string) {
    const slot = newDayTimeSlots[dayKey];
    if (!slot) return;
    setTask((t) => {
      if (!t) return t;
      const current =
        t.regularTimesByDay && typeof t.regularTimesByDay === "object" && !Array.isArray(t.regularTimesByDay)
          ? t.regularTimesByDay
          : {};
      const dayTimes = Array.isArray(current[dayKey]) ? current[dayKey] : [];
      return { ...t, regularTimesByDay: { ...current, [dayKey]: Array.from(new Set([...dayTimes, slot])).sort() } };
    });
    setNewDayTimeSlots((prev) => ({ ...prev, [dayKey]: "" }));
  }

  function removeDayTimeSlot(dayKey: string, slot: string) {
    setTask((t) => {
      if (!t) return t;
      const current =
        t.regularTimesByDay && typeof t.regularTimesByDay === "object" && !Array.isArray(t.regularTimesByDay)
          ? t.regularTimesByDay
          : {};
      const dayTimes = Array.isArray(current[dayKey]) ? current[dayKey] : [];
      return { ...t, regularTimesByDay: { ...current, [dayKey]: dayTimes.filter((s) => s !== slot) } };
    });
  }

  async function removeTask() {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/task-templates?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      removeDraftRecord(buildDraftStorageKey("task", id));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TASK_TEMPLATE_REFRESH_EVENT));
        try {
          window.sessionStorage.setItem(TASK_TEMPLATE_DELETED_STORAGE_KEY, id);
          window.localStorage.setItem(TASK_TEMPLATE_REFRESH_STORAGE_KEY, new Date().toISOString());
        } catch (error) {
          console.error(error);
        }
      }
      invalidateWorkspaceResource("tasks");
      invalidateWorkspaceResource(taskDataKey(id));
      if (!navigateWithinSpa("/tasks")) router.push("/tasks");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  }

  if (!task) {
    return (
      <div className="w-full px-3 py-4">
        <div className="card max-w-xl p-5">
          <h1 className="text-xl font-semibold text-slate-900">Task not found</h1>
          <p className="mt-2 text-sm text-slate-600">That task template does not exist.</p>
          <div className="mt-4">
            <Link
              href="/tasks"
              className="btn h-9 px-4"
              onClick={(event) => {
                if (shouldHandleSpaClick(event) && navigateWithinSpa("/tasks")) {
                  event.preventDefault();
                }
              }}
            >
              Back to tasks
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const saveStatusText = formatAutosaveStatusText(saveState);
  const saveStatusClassName = getAutosaveStatusClassName(saveState);
  const allDaysChecked = REGULAR_DAYS.every((day) => (task.regularDays || []).includes(day.key));
  const totalFixedSlots =
    (task.regularTimes || []).length +
    Object.values(task.regularTimesByDay || {}).reduce(
      (sum, times) => sum + (Array.isArray(times) ? times.length : 0),
      0
    );
  const hasWindowRules =
    !!task.autogenStart ||
    !!task.autogenEnd ||
    Object.values(task.regularDayWindows || {}).some((window) => !!window?.start || !!window?.end);
  const taskRole = getAutofillTaskRole({
    hasFixedTimes: totalFixedSlots > 0,
    mustManned: !!task.mustManned,
    minPerEmp: Number(task.minPerEmployeePerDay) || 0,
    fixedTimeBlock: hasWindowRules,
    attendedByAll: !!task.attendedByAll,
    overwriteExistingTasks: !!task.overwriteExistingTasks,
  });
  const roleMeta = AUTOFILL_ROLE_META[taskRole];
  const summaryChips = [
    Number(task.durationMinutes) > 0 ? `${task.durationMinutes} min length` : "Flexible length",
    Number(task.maxConsecutiveMinutes) > 0 ? `Max ${task.maxConsecutiveMinutes} min in a row` : "No consecutive cap",
    Number(task.minPerEmployeePerDay) > 0 ? `${task.minPerEmployeePerDay} per employee` : null,
    Number(task.maxPerEmployeePerDay) > 0 ? `Up to ${task.maxPerEmployeePerDay} per employee` : null,
    Number(task.maxConcurrentPerTimeslot) > 0 ? `${task.maxConcurrentPerTimeslot} at once` : "No overlap cap",
    totalFixedSlots > 0 ? `${totalFixedSlots} fixed slot${totalFixedSlots === 1 ? "" : "s"}` : hasWindowRules ? "Windowed by day" : "Whole-day window",
    (task.regularDays || []).length > 0 ? `${(task.regularDays || []).length} active day${(task.regularDays || []).length === 1 ? "" : "s"}` : "No active days",
    Number(task.waitingMinutes) > 0 ? `+${task.waitingMinutes} min waiting` : null,
    Number(task.packingMinutes) > 0 ? `+${task.packingMinutes} min packing` : null,
    task.schoolTourImportTarget ? "School-tour target" : null,
  ].filter((chip): chip is string => !!chip);

  return (
    <div className="w-full px-3 py-4">
      <div className="flex w-full max-w-[1080px] flex-col gap-3">
        <div className="flex items-center gap-1 text-[14px]">
          <Link
            href="/tasks"
            className="font-semibold text-[#675dff] hover:underline"
            onClick={(event) => {
              if (shouldHandleSpaClick(event) && navigateWithinSpa("/tasks")) {
                event.preventDefault();
              }
            }}
          >
            Tasks
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-700" />
          <span className="font-medium text-slate-600">{task.name || "Task"}</span>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="break-words text-[clamp(1.5rem,4vw,2.05rem)] font-bold leading-tight text-slate-900">
              {task.name || "Task"}
            </h1>
            <p className="text-[15px] font-medium text-slate-600">Rules, timing, and autofill behavior for this task.</p>
            <p className={`text-[12px] font-medium ${saveStatusClassName}`}>{saveStatusText}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[var(--radius-md)] border border-red-300 bg-white px-3 text-[13px] font-medium text-red-700 transition hover:bg-red-600 hover:text-white"
              onClick={removeTask}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void saveNow({ mode: "manual" })}
              disabled={saveState.state === "saving"}
            >
              <Save className="h-4 w-4" />
              {saveState.state === "saving" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_380px]">
          <SectionCard
            title="Task details"
            description="Keep the core task settings together so the roster uses the right colour, duration, and coverage rules."
          >
            <div className="space-y-4">
              <FieldBlock label="Name">
                <input
                  className="input h-10 w-full text-[14px]"
                  value={task.name}
                  onChange={(event) => setTask((t) => (t ? { ...t, name: event.target.value } : t))}
                />
              </FieldBlock>

              <div className="grid gap-3 md:grid-cols-3">
                <FieldBlock label="Colour">
                  <input
                    type="color"
                    className="h-10 w-full max-w-[160px] rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-1"
                    value={task.color || "#ffffff"}
                    onChange={(event) => setTask((t) => (t ? { ...t, color: event.target.value } : t))}
                  />
                </FieldBlock>

                <FieldBlock label="Length">
                  <select
                    className="input h-10 w-full text-[14px]"
                    value={Number.isFinite(task.durationMinutes) ? task.durationMinutes : 0}
                    onChange={(event) =>
                      setTask((t) => (t ? { ...t, durationMinutes: Number(event.target.value) } : t))
                    }
                  >
                    <option value={0}>Not set</option>
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                </FieldBlock>

                <FieldBlock label="Max consecutive time" hint="0 means this task can run without a consecutive cap.">
                  <select
                    className="input h-10 w-full text-[14px]"
                    value={Number.isFinite(task.maxConsecutiveMinutes) ? task.maxConsecutiveMinutes : 0}
                    onChange={(event) =>
                      setTask((t) =>
                        t ? { ...t, maxConsecutiveMinutes: Number(event.target.value) } : t
                      )
                    }
                  >
                    <option value={0}>No limit</option>
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                </FieldBlock>
              </div>
            </div>
          </SectionCard>

          <div className="flex flex-col gap-3">
            <SectionCard
              title="Rule summary"
              description="This is how the autofill engine now interprets the task before it starts placing work."
            >
              <div className="space-y-3">
                <div className={`rounded-[12px] border px-3 py-3 ${roleMeta.accent}`}>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em]">Autofill role</p>
                  <p className="mt-1 text-[18px] font-bold">{roleMeta.label}</p>
                  <p className="mt-1 text-[13px] font-medium leading-5">{roleMeta.description}</p>
                </div>
                <div className="rounded-[12px] border border-[var(--border)] bg-white p-3">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Hard rules</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {summaryChips.map((chip) => (
                      <span
                        key={chip}
                        className="inline-flex min-h-8 items-center rounded-full border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-1 text-[12px] font-semibold text-slate-700"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Autofill behavior"
              description="These controls change the role this task plays when the roster is generated."
            >
              <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white">
                <ToggleRow
                  id="task-enabled"
                  label="Enabled"
                  description="Include this task in autofill."
                  checked={task.enabled !== false}
                  onChange={(checked) => setTask((t) => (t ? { ...t, enabled: checked } : t))}
                />
                <div className="border-t border-[var(--border)]" />
                <ToggleRow
                  id="task-waiting"
                  label="Waiting for"
                  description="Adds 15 minutes before the task starts."
                  checked={(task.waitingMinutes || 0) > 0}
                  onChange={(checked) => setTask((t) => (t ? { ...t, waitingMinutes: checked ? 15 : 0 } : t))}
                />
                <div className="border-t border-[var(--border)]" />
                <ToggleRow
                  id="task-packing"
                  label="Packing up"
                  description="Adds 15 minutes after the task ends."
                  checked={(task.packingMinutes || 0) > 0}
                  onChange={(checked) => setTask((t) => (t ? { ...t, packingMinutes: checked ? 15 : 0 } : t))}
                />
                <div className="border-t border-[var(--border)]" />
                <ToggleRow
                  id="tour-task"
                  label="Protect core time"
                  description="When this task overwrites conflicts, only the main task time is protected. Waiting and packing stay outside that protected window."
                  checked={!!task.mustManned && !!task.overwriteExistingTasks}
                  onChange={(checked) =>
                    setTask((t) =>
                      t
                        ? {
                            ...t,
                            mustManned: checked ? true : t.mustManned,
                            overwriteExistingTasks: checked,
                          }
                        : t
                    )
                  }
                />
                <div className="border-t border-[var(--border)]" />
                <ToggleRow
                  id="must-manned"
                  label="Must always be manned"
                  description="Treat this as a required coverage task during autofill."
                  checked={!!task.mustManned}
                  onChange={(checked) => setTask((t) => (t ? { ...t, mustManned: checked } : t))}
                />
                <div className="border-t border-[var(--border)]" />
                <ToggleRow
                  id="overwrite-existing-tasks"
                  label="Overwrite other tasks"
                  description="Runs late in autofill and replaces conflicting tasks in the same slot."
                  checked={!!task.overwriteExistingTasks}
                  onChange={(checked) => setTask((t) => (t ? { ...t, overwriteExistingTasks: checked } : t))}
                />
                <div className="border-t border-[var(--border)]" />
                <ToggleRow
                  id="school-tour-import-target"
                  label="Use for imported school tours"
                  description="Imported school runsheets use this task's colour, duration, waiting time, and overwrite rules."
                  checked={!!task.schoolTourImportTarget}
                  onChange={(checked) => setTask((t) => (t ? { ...t, schoolTourImportTarget: checked } : t))}
                />
                <div className="border-t border-[var(--border)]" />
                <ToggleRow
                  id="attended-by-all"
                  label="Attended by all"
                  description="Everyone working in that slot gets this task."
                  checked={!!task.attendedByAll}
                  onChange={(checked) => setTask((t) => (t ? { ...t, attendedByAll: checked } : t))}
                />
              </div>
            </SectionCard>
          </div>
        </div>

        <SectionCard
          title="Regularity"
          description="Choose the days this task is allowed on and the hard start and end window for each day."
        >
          <div className="overflow-x-auto">
            <div className="min-w-[560px] overflow-hidden rounded-[10px] border border-[var(--border)]">
              <div className="grid grid-cols-[minmax(0,1fr)_140px_140px] gap-3 bg-[var(--surface-subtle)] px-4 py-2.5 text-[13px] font-semibold text-slate-700">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={allDaysChecked}
                    onChange={(event) => toggleAllDays(event.target.checked)}
                    style={{ accentColor: "rgb(103, 93, 255)" }}
                  />
                  <span>All days</span>
                </label>
                <span>From</span>
                <span>To</span>
              </div>

              {REGULAR_DAYS.map((day, index) => {
                const checked = (task.regularDays || []).includes(day.key);
                const dayWindow = task.regularDayWindows?.[day.key] || {};
                return (
                  <div
                    key={day.key}
                    className={`grid grid-cols-[minmax(0,1fr)_140px_140px] items-center gap-3 px-4 py-2.5 ${
                      index === 0 ? "" : "border-t border-[var(--border)]"
                    }`}
                  >
                    <label className="inline-flex items-center gap-2 text-[15px] text-slate-700">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRegularDay(day.key)}
                        style={{ accentColor: "rgb(103, 93, 255)" }}
                      />
                      <span className={checked ? "font-medium text-slate-800" : "text-slate-500"}>
                        {day.label}
                      </span>
                    </label>
                    <input
                      type="time"
                      className="input time-input-no-icon h-9 w-[140px] px-3 text-[13px]"
                      value={dayWindow.start || ""}
                      onChange={(event) => updateDayWindow(day.key, "start", event.target.value)}
                      disabled={!checked}
                      aria-label={`${day.label} start time`}
                    />
                    <input
                      type="time"
                      className="input time-input-no-icon h-9 w-[140px] px-3 text-[13px]"
                      value={dayWindow.end || ""}
                      onChange={(event) => updateDayWindow(day.key, "end", event.target.value)}
                      disabled={!checked}
                      aria-label={`${day.label} end time`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Time slots"
          description="Use default slots when the task repeats across days, then add day-specific slots only where a day needs an exception."
        >
          <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
            <div className="space-y-3">
              <FieldBlock
                label="Default time slots"
                hint="These slots are available on any selected day unless a day-specific list is used instead."
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="time"
                    className="input time-input-no-icon h-9 w-[150px] px-3 text-[13px]"
                    value={newTimeSlot}
                    onChange={(event) => setNewTimeSlot(event.target.value)}
                  />
                  <button className="btn h-9 px-3" type="button" onClick={addTimeSlot}>
                    Add time
                  </button>
                </div>
              </FieldBlock>

              {(task.regularTimes || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(task.regularTimes || []).map((slot) => (
                    <SlotChip
                      key={slot}
                      label={slot}
                      removeLabel={`Remove ${slot}`}
                      onRemove={() => removeTimeSlot(slot)}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-slate-500">No default slots yet.</p>
              )}
            </div>

            <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white">
              {REGULAR_DAYS.map((day, index) => {
                const dayTimes = Array.isArray(task.regularTimesByDay?.[day.key]) ? task.regularTimesByDay?.[day.key] || [] : [];
                return (
                  <div
                    key={day.key}
                    className={`grid gap-3 px-4 py-2.5 md:grid-cols-[120px_minmax(0,1fr)] ${
                      index === 0 ? "" : "border-t border-[var(--border)]"
                    }`}
                  >
                    <div className="pt-1 text-[15px] font-semibold text-slate-800">{day.label}</div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="time"
                          className="input time-input-no-icon h-9 w-[150px] px-3 text-[13px]"
                          value={newDayTimeSlots[day.key] || ""}
                          onChange={(event) =>
                            setNewDayTimeSlots((prev) => ({ ...prev, [day.key]: event.target.value }))
                          }
                        />
                        <button
                          className="btn h-9 px-3"
                          type="button"
                          onClick={() => addDayTimeSlot(day.key)}
                          disabled={!newDayTimeSlots[day.key]}
                        >
                          Add time
                        </button>
                      </div>

                      {dayTimes.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {dayTimes.map((slot) => (
                            <SlotChip
                              key={`${day.key}-${slot}`}
                              label={slot}
                              removeLabel={`Remove ${slot} on ${day.label}`}
                              onRemove={() => removeDayTimeSlot(day.key, slot)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-[12px] text-slate-500">No day-specific slots.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Limits"
          description="Set hard caps when this task should appear a fixed number of times across the day or per employee."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <FieldBlock label="Minimum per employee per day" hint="How many times each employee should get this task.">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input h-10 w-[120px] text-[14px]"
                  value={Number.isFinite(task.minPerEmployeePerDay) ? task.minPerEmployeePerDay : 0}
                  onChange={(event) =>
                    setTask((t) =>
                      t ? { ...t, minPerEmployeePerDay: Math.max(0, Number(event.target.value || 0)) } : t
                    )
                  }
                />
                <span className="text-[12px] text-slate-500">times</span>
              </div>
            </FieldBlock>

            <FieldBlock label="Maximum per employee per day" hint="Use 0 when you do not want a per-person cap.">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input h-10 w-[120px] text-[14px]"
                  value={Number.isFinite(task.maxPerEmployeePerDay) ? task.maxPerEmployeePerDay : 0}
                  onChange={(event) =>
                    setTask((t) =>
                      t ? { ...t, maxPerEmployeePerDay: Math.max(0, Number(event.target.value || 0)) } : t
                    )
                  }
                />
                <span className="text-[12px] text-slate-500">times</span>
              </div>
            </FieldBlock>

            <FieldBlock label="Limit per day" hint="0 means there is no hard maximum number of times the task can appear.">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input h-10 w-[120px] text-[14px]"
                  value={Number.isFinite(task.limitPerDay) ? task.limitPerDay : 0}
                  onChange={(event) =>
                    setTask((t) => (t ? { ...t, limitPerDay: Math.max(0, Number(event.target.value || 0)) } : t))
                  }
                />
                <span className="text-[12px] text-slate-500">times</span>
              </div>
            </FieldBlock>

            <FieldBlock
              label="Max overlapping at once"
              hint="0 means there is no hard overlap cap, but autofill still spreads tasks first."
            >
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  step={1}
                  className="input h-10 w-[120px] text-[14px]"
                  value={Number.isFinite(task.maxConcurrentPerTimeslot) ? task.maxConcurrentPerTimeslot : 0}
                  onChange={(event) =>
                    setTask((t) =>
                      t
                        ? { ...t, maxConcurrentPerTimeslot: Math.max(0, Number(event.target.value || 0)) }
                        : t
                    )
                  }
                />
                <span className="text-[12px] text-slate-500">times</span>
              </div>
            </FieldBlock>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
