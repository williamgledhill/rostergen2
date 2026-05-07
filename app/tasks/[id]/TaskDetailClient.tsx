"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Save, Trash2, X } from "lucide-react";
import {
  buildDraftStorageKey,
  formatAutosaveStatusText,
  getAutosaveStatusClassName,
  removeDraftRecord,
} from "@/lib/clientDrafts";
import { navigateWithinSpa, shouldHandleSpaClick } from "@/lib/spaNavigation";
import { invalidateWorkspaceResource, taskDataKey, writeCachedResource } from "@/lib/workspaceData";
import {
  TASK_TEMPLATE_DELETED_STORAGE_KEY,
  TASK_TEMPLATE_REFRESH_EVENT,
  TASK_TEMPLATE_REFRESH_STORAGE_KEY,
  type TaskTemplate,
} from "@/lib/taskTemplates";
import { usePersistedAutosave } from "@/lib/usePersistedAutosave";

const REGULAR_DAYS = [
  { key: "Mon", short: "M", label: "Monday" },
  { key: "Tue", short: "T", label: "Tuesday" },
  { key: "Wed", short: "W", label: "Wednesday" },
  { key: "Thu", short: "T", label: "Thursday" },
  { key: "Fri", short: "F", label: "Friday" },
  { key: "Sat", short: "S", label: "Saturday" },
  { key: "Sun", short: "S", label: "Sunday" },
] as const;

type RegularDayKey = (typeof REGULAR_DAYS)[number]["key"];

const DEFAULT_FIXED_MINUTES = 60;
const DEFAULT_BUFFER_MINUTES = 15;
const MINUTE_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

function toMinutes(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0;
}

function normaliseTimes(times: string[]) {
  return Array.from(new Set(times.filter(Boolean))).sort();
}

function getDayTimes(task: TaskTemplate, dayKey: RegularDayKey) {
  const byDay = task.regularTimesByDay;
  if (!byDay || typeof byDay !== "object" || Array.isArray(byDay)) return [];
  const times = byDay[dayKey];
  return Array.isArray(times) ? normaliseTimes(times) : [];
}

function getDayWindow(task: TaskTemplate, dayKey: RegularDayKey) {
  const windows = task.regularDayWindows;
  if (!windows || typeof windows !== "object" || Array.isArray(windows)) return {};
  return windows[dayKey] || {};
}

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
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
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
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[14px] font-semibold text-slate-900">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-[13px] font-medium leading-5 text-slate-600">{description}</p> : null}
      </div>
      <label htmlFor={id} className="relative inline-flex cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-[var(--accent)]" />
        <span className="absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
      </label>
    </div>
  );
}

function TimeChip({
  label,
  removeLabel,
  onRemove,
}: {
  label: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2.5 text-[13px] font-semibold text-slate-700">
      <span>{label}</span>
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-[6px] text-slate-500 transition hover:bg-white hover:text-slate-800"
        onClick={onRemove}
        aria-label={removeLabel}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export default function TaskDetailClient({ id, initialTask }: { id: string; initialTask: TaskTemplate | null }) {
  const router = useRouter();
  const initialTaskValue = useMemo(() => initialTask, [initialTask]);
  const [newDayTimeSlots, setNewDayTimeSlots] = useState<Record<string, string>>({});
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

  function updateTask(patch: Partial<TaskTemplate>) {
    setTask((current) => (current ? { ...current, ...patch } : current));
  }

  function setFixedTimeEnabled(checked: boolean) {
    setTask((current) => {
      if (!current) return current;
      const currentMinutes = Number(current.durationMinutes) || 0;
      return {
        ...current,
        durationMinutes: checked ? currentMinutes || DEFAULT_FIXED_MINUTES : 0,
      };
    });
  }

  function setWaitingEnabled(checked: boolean) {
    setTask((current) => {
      if (!current) return current;
      const currentMinutes = Number(current.waitingMinutes) || 0;
      return {
        ...current,
        waitingMinutes: checked ? currentMinutes || DEFAULT_BUFFER_MINUTES : 0,
      };
    });
  }

  function setPackingEnabled(checked: boolean) {
    setTask((current) => {
      if (!current) return current;
      const currentMinutes = Number(current.packingMinutes) || 0;
      return {
        ...current,
        packingMinutes: checked ? currentMinutes || DEFAULT_BUFFER_MINUTES : 0,
      };
    });
  }

  function toggleRegularDay(dayKey: RegularDayKey, checked: boolean) {
    setTask((current) => {
      if (!current) return current;
      const days = new Set(current.regularDays || []);
      const regularTimesByDay =
        current.regularTimesByDay && typeof current.regularTimesByDay === "object" && !Array.isArray(current.regularTimesByDay)
          ? { ...current.regularTimesByDay }
          : {};
      const regularDayWindows =
        current.regularDayWindows && typeof current.regularDayWindows === "object" && !Array.isArray(current.regularDayWindows)
          ? { ...current.regularDayWindows }
          : {};

      if (checked) {
        days.add(dayKey);
      } else {
        days.delete(dayKey);
        delete regularTimesByDay[dayKey];
        delete regularDayWindows[dayKey];
      }

      return {
        ...current,
        regularDays: REGULAR_DAYS.map((day) => day.key).filter((day) => days.has(day)),
        regularTimesByDay,
        regularDayWindows,
      };
    });
  }

  function updateDayWindow(dayKey: RegularDayKey, field: "start" | "end", value: string) {
    setTask((current) => {
      if (!current) return current;
      const days = new Set(current.regularDays || []);
      days.add(dayKey);
      const currentWindows =
        current.regularDayWindows && typeof current.regularDayWindows === "object" && !Array.isArray(current.regularDayWindows)
          ? current.regularDayWindows
          : {};
      const existingWindow = currentWindows[dayKey] || {};
      const nextWindow = { ...existingWindow, [field]: value };
      const regularDayWindows = { ...currentWindows };

      if (!nextWindow.start && !nextWindow.end) {
        delete regularDayWindows[dayKey];
      } else {
        regularDayWindows[dayKey] = nextWindow;
      }

      return {
        ...current,
        regularDays: REGULAR_DAYS.map((day) => day.key).filter((day) => days.has(day)),
        regularDayWindows,
      };
    });
  }

  function addDayTimeSlot(dayKey: RegularDayKey) {
    const slot = newDayTimeSlots[dayKey];
    if (!slot) return;
    setTask((current) => {
      if (!current) return current;
      const currentByDay =
        current.regularTimesByDay && typeof current.regularTimesByDay === "object" && !Array.isArray(current.regularTimesByDay)
          ? current.regularTimesByDay
          : {};
      const currentTimes = Array.isArray(currentByDay[dayKey]) ? currentByDay[dayKey] : [];
      const days = new Set(current.regularDays || []);
      days.add(dayKey);
      return {
        ...current,
        regularDays: REGULAR_DAYS.map((day) => day.key).filter((day) => days.has(day)),
        regularTimesByDay: {
          ...currentByDay,
          [dayKey]: normaliseTimes([...currentTimes, slot]),
        },
      };
    });
    setNewDayTimeSlots((current) => ({ ...current, [dayKey]: "" }));
  }

  function removeDayTimeSlot(dayKey: RegularDayKey, slot: string) {
    setTask((current) => {
      if (!current) return current;
      const currentByDay =
        current.regularTimesByDay && typeof current.regularTimesByDay === "object" && !Array.isArray(current.regularTimesByDay)
          ? { ...current.regularTimesByDay }
          : {};
      const nextTimes = normaliseTimes((Array.isArray(currentByDay[dayKey]) ? currentByDay[dayKey] : []).filter((time) => time !== slot));
      if (nextTimes.length) {
        currentByDay[dayKey] = nextTimes;
      } else {
        delete currentByDay[dayKey];
      }
      return { ...current, regularTimesByDay: currentByDay };
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
      <div className="workspace-page">
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
  const fixedTimeEnabled = (Number(task.durationMinutes) || 0) > 0;
  const waitingEnabled = (Number(task.waitingMinutes) || 0) > 0;
  const packingEnabled = (Number(task.packingMinutes) || 0) > 0;

  return (
    <div className="workspace-page">
      <div className="flex w-full max-w-[1040px] flex-col gap-5">
        <div className="flex items-center gap-1 text-[14px]">
          <Link
            href="/tasks"
            className="font-semibold text-[var(--accent)] hover:underline"
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
            <h1 className="page-title break-words">
              {task.name || "Task"}
            </h1>
            <p className="page-description mt-3">Task settings and fixed-time rules.</p>
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

        <SectionCard title="Task details">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <FieldBlock label="Name">
              <input
                className="input h-10 w-full text-[14px]"
                value={task.name}
                onChange={(event) => updateTask({ name: event.target.value })}
              />
            </FieldBlock>

            <FieldBlock label="Colour">
              <input
                type="color"
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-1"
                value={task.color || "#ffffff"}
                onChange={(event) => updateTask({ color: event.target.value })}
              />
            </FieldBlock>
          </div>
        </SectionCard>

        <SectionCard title="Settings">
          <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white">
            <ToggleRow
              id="must-manned"
              label="Must be manned"
              checked={!!task.mustManned}
              onChange={(checked) => updateTask({ mustManned: checked })}
            />
            <div className="border-t border-[var(--border)]" />
            <ToggleRow
              id="fixed-time"
              label="Fixed time"
              checked={fixedTimeEnabled}
              onChange={setFixedTimeEnabled}
            />
            {fixedTimeEnabled ? (
              <div className="border-t border-[var(--border)] px-4 py-3">
                <FieldBlock label="Fixed time length">
                  <select
                    className="input h-10 w-full max-w-[220px] text-[14px]"
                    value={Number(task.durationMinutes) || DEFAULT_FIXED_MINUTES}
                    onChange={(event) => updateTask({ durationMinutes: toMinutes(event.target.value) })}
                  >
                    {MINUTE_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                </FieldBlock>
              </div>
            ) : null}
            <div className="border-t border-[var(--border)]" />
            <ToggleRow
              id="waiting-beforehand"
              label="Waiting for beforehand"
              checked={waitingEnabled}
              onChange={setWaitingEnabled}
            />
            {waitingEnabled ? (
              <div className="border-t border-[var(--border)] px-4 py-3">
                <FieldBlock label="Waiting length">
                  <select
                    className="input h-10 w-full max-w-[220px] text-[14px]"
                    value={Number(task.waitingMinutes) || DEFAULT_BUFFER_MINUTES}
                    onChange={(event) => updateTask({ waitingMinutes: toMinutes(event.target.value) })}
                  >
                    {MINUTE_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                </FieldBlock>
              </div>
            ) : null}
            <div className="border-t border-[var(--border)]" />
            <ToggleRow
              id="packing-up"
              label="Packing up"
              checked={packingEnabled}
              onChange={setPackingEnabled}
            />
            {packingEnabled ? (
              <div className="border-t border-[var(--border)] px-4 py-3">
                <FieldBlock label="Packing length">
                  <select
                    className="input h-10 w-full max-w-[220px] text-[14px]"
                    value={Number(task.packingMinutes) || DEFAULT_BUFFER_MINUTES}
                    onChange={(event) => updateTask({ packingMinutes: toMinutes(event.target.value) })}
                  >
                    {MINUTE_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                </FieldBlock>
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard
          title="When it occurs"
          description="Use exact times for fixed appointments, or a range when the task can happen any time inside a window."
        >
          <div className="overflow-hidden rounded-[10px] border border-[var(--border)] bg-white">
            <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500 sm:grid-cols-[96px_minmax(0,1fr)]">
              <span>Day</span>
              <span>Time rule</span>
            </div>
            {REGULAR_DAYS.map((day, index) => {
              const checked = (task.regularDays || []).includes(day.key);
              const dayTimes = getDayTimes(task, day.key);
              const dayWindow = getDayWindow(task, day.key);
              return (
                <div
                  key={day.key}
                  className={`grid gap-3 px-4 py-3 sm:grid-cols-[96px_minmax(0,1fr)] ${
                    index === 0 ? "" : "border-t border-[var(--border)]"
                  }`}
                >
                  <label className="inline-flex h-10 items-center gap-2 text-[14px] font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => toggleRegularDay(day.key, event.target.checked)}
                    />
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] bg-[var(--surface-subtle)] text-[13px]">
                      {day.short}
                    </span>
                  </label>
                  <div className="min-w-0 space-y-2">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                      <div className="space-y-1.5">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Exact times
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            className="input time-input-no-icon h-10 w-[150px] px-3 text-[13px]"
                            value={newDayTimeSlots[day.key] || ""}
                            onChange={(event) =>
                              setNewDayTimeSlots((current) => ({ ...current, [day.key]: event.target.value }))
                            }
                            disabled={!checked}
                            aria-label={`${day.label} fixed time`}
                          />
                          <button
                            type="button"
                            className="btn h-10 px-3"
                            onClick={() => addDayTimeSlot(day.key)}
                            disabled={!checked || !newDayTimeSlots[day.key]}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Fixed range
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="time"
                            className="input time-input-no-icon h-10 w-[132px] px-3 text-[13px]"
                            value={dayWindow.start || ""}
                            onChange={(event) => updateDayWindow(day.key, "start", event.target.value)}
                            disabled={!checked}
                            aria-label={`${day.label} range start`}
                          />
                          <span className="text-[13px] font-semibold text-slate-600">to</span>
                          <input
                            type="time"
                            className="input time-input-no-icon h-10 w-[132px] px-3 text-[13px]"
                            value={dayWindow.end || ""}
                            onChange={(event) => updateDayWindow(day.key, "end", event.target.value)}
                            disabled={!checked}
                            aria-label={`${day.label} range end`}
                          />
                        </div>
                      </div>
                    </div>
                    {dayTimes.length ? (
                      <div className="flex flex-wrap gap-2">
                        {dayTimes.map((slot) => (
                          <TimeChip
                            key={`${day.key}-${slot}`}
                            label={slot}
                            removeLabel={`Remove ${slot} on ${day.label}`}
                            onRemove={() => removeDayTimeSlot(day.key, slot)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
