"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, X } from "lucide-react";
import { useFeedback } from "@/components/ui/Feedback";
import PageHeader from "@/components/ui/PageHeader";
import SaveStatus from "@/components/ui/SaveStatus";
import SpaLink from "@/components/ui/SpaLink";
import Switch from "@/components/ui/Switch";
import { buildDraftStorageKey, removeDraftRecord } from "@/lib/clientDrafts";
import { DAY_KEYS, DAY_LABELS, type DayKey } from "@/lib/settingsDefaults";
import { navigateWithinSpa } from "@/lib/spaNavigation";
import {
  TASK_TEMPLATE_DELETED_STORAGE_KEY,
  TASK_TEMPLATE_REFRESH_EVENT,
  TASK_TEMPLATE_REFRESH_STORAGE_KEY,
  TOUR_CATEGORY,
  TOUR_WAITING_MINUTES,
  isFloorTemplate,
  isTourTemplate,
  type TaskTemplate,
} from "@/lib/taskTemplates";
import { usePersistedAutosave } from "@/lib/usePersistedAutosave";
import { invalidateWorkspaceResource, loadTasksData, taskDataKey, writeCachedResource } from "@/lib/workspaceData";

const DEFAULT_FIXED_MINUTES = 60;
/** Matches autofill's rotation for tasks without a fixed time. */
const DEFAULT_IDEAL_STINT_MINUTES = 60;
const DEFAULT_BUFFER_MINUTES = 15;
const MINUTE_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

type TimesByDay = Record<string, string[]>;
type TimeRange = { start?: string; end?: string };
type WindowsByDay = Record<string, TimeRange>;
type ExtraWindowsByDay = Record<string, TimeRange[]>;

function toMinutes(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.round(next)) : 0;
}

function normaliseTimes(times: string[]) {
  return Array.from(new Set(times.filter(Boolean))).sort();
}

function asRecord<T>(value: unknown): Record<string, T> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, T>) : {};
}

function orderedDays(days: Set<string>) {
  return DAY_KEYS.filter((day) => days.has(day));
}

function notifyTemplatesChanged() {
  window.dispatchEvent(new Event(TASK_TEMPLATE_REFRESH_EVENT));
  try {
    window.localStorage.setItem(TASK_TEMPLATE_REFRESH_STORAGE_KEY, new Date().toISOString());
  } catch (error) {
    console.error(error);
  }
}

function SettingRow({
  id,
  label,
  description,
  checked,
  onChange,
  children,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={id} className="block text-[14px] font-medium">
            {label}
          </label>
          {description && <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{description}</p>}
        </div>
        <Switch id={id} checked={checked} onChange={onChange} />
      </div>
      {checked && children && <div className="mt-3">{children}</div>}
    </div>
  );
}

function RuleGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <div className="bg-[var(--surface-subtle)] px-5 py-2">
        <span className="text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">{title}</span>
        {description && <span className="ml-2 text-[12px] text-[var(--text-faint)]">{description}</span>}
      </div>
      <div className="divide-y divide-[var(--border)]">{children}</div>
    </div>
  );
}

/** A whole-number limit where 0 (shown blank) means none. */
function CountRule({
  id,
  label,
  value,
  placeholder = "No limit",
  onChange,
}: {
  id: string;
  label: string;
  value?: number;
  placeholder?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        max={99}
        inputMode="numeric"
        className="input w-[120px]"
        placeholder={placeholder}
        value={Number(value) > 0 ? Number(value) : ""}
        onChange={(event) => onChange(toMinutes(event.target.value))}
      />
    </div>
  );
}

function MinutesSelect({ id, value, onChange }: { id: string; value: number; onChange: (minutes: number) => void }) {
  return (
    <select id={id} className="input w-[160px]" value={value} onChange={(event) => onChange(toMinutes(event.target.value))}>
      {MINUTE_OPTIONS.map((minutes) => (
        <option key={minutes} value={minutes}>
          {minutes} minutes
        </option>
      ))}
    </select>
  );
}

export default function TaskDetailClient({ id, initialTask }: { id: string; initialTask: TaskTemplate | null }) {
  const router = useRouter();
  const { confirm, notify } = useFeedback();
  const initialTaskValue = useMemo(() => initialTask, [initialTask]);
  const [newTimes, setNewTimes] = useState<Record<string, string>>({});
  const { value: task, setValue: setTask, saveState, saveNow } = usePersistedAutosave<TaskTemplate | null>({
    storageKey: buildDraftStorageKey("task", id),
    initialValue: initialTaskValue,
    getSignature: (value) => JSON.stringify(value),
    canSaveValue: (value) => !!value?.name.trim(),
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
      notifyTemplatesChanged();
      if (mode === "manual") router.refresh();
      writeCachedResource(taskDataKey(id), saved);
      invalidateWorkspaceResource("tasks");
      return { value: saved, savedAt: new Date().toISOString() };
    },
  });

  const [otherTasks, setOtherTasks] = useState<TaskTemplate[]>([]);
  useEffect(() => {
    let cancelled = false;
    loadTasksData()
      .then((tasks) => {
        if (!cancelled) setOtherTasks((tasks ?? []).filter((entry) => entry.id !== id));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  function updateTask(patch: Partial<TaskTemplate>) {
    setTask((current) => (current ? { ...current, ...patch } : current));
  }

  /** Turning a duration on starts from a sensible default; turning it off stores 0. */
  function toggleMinutes(
    field: "durationMinutes" | "waitingMinutes" | "packingMinutes" | "maxConsecutiveMinutes",
    fallback: number
  ) {
    return (checked: boolean) =>
      setTask((current) =>
        current ? { ...current, [field]: checked ? Number(current[field]) || fallback : 0 } : current
      );
  }

  function toggleDay(day: DayKey, checked: boolean) {
    setTask((current) => {
      if (!current) return current;
      const days = new Set(current.regularDays || []);
      const timesByDay = { ...asRecord<string[]>(current.regularTimesByDay) };
      const windows = { ...asRecord<TimeRange>(current.regularDayWindows) };
      const extraWindows = { ...asRecord<TimeRange[]>(current.extraDayWindows) };
      if (checked) {
        days.add(day);
      } else {
        days.delete(day);
        delete timesByDay[day];
        delete windows[day];
        delete extraWindows[day];
      }
      return {
        ...current,
        regularDays: orderedDays(days),
        regularTimesByDay: timesByDay,
        regularDayWindows: windows,
        extraDayWindows: extraWindows,
      };
    });
  }

  /** A day's time ranges: the first is stored in regularDayWindows, any others in extraDayWindows. */
  function dayRanges(current: TaskTemplate, day: DayKey): TimeRange[] {
    const first = asRecord<TimeRange>(current.regularDayWindows)[day];
    const extras = asRecord<TimeRange[]>(current.extraDayWindows)[day] ?? [];
    return [first ?? {}, ...extras];
  }

  function setDayRanges(day: DayKey, change: (ranges: TimeRange[]) => TimeRange[]) {
    setTask((current) => {
      if (!current) return current;
      // Empty ranges are dropped, except a new one still being typed in.
      const ranges = change(dayRanges(current, day));
      const [first, ...extras] = ranges;
      const windows: WindowsByDay = { ...asRecord(current.regularDayWindows) };
      const extraWindows: ExtraWindowsByDay = { ...asRecord(current.extraDayWindows) };
      if (first && (first.start || first.end)) windows[day] = first;
      else delete windows[day];
      if (extras.length) extraWindows[day] = extras;
      else delete extraWindows[day];
      return {
        ...current,
        regularDays: orderedDays(new Set([...(current.regularDays || []), day])),
        regularDayWindows: windows,
        extraDayWindows: extraWindows,
      };
    });
  }

  function updateDayRange(day: DayKey, index: number, field: "start" | "end", value: string) {
    setDayRanges(day, (ranges) => ranges.map((range, i) => (i === index ? { ...range, [field]: value } : range)));
  }

  function addDayRange(day: DayKey) {
    setDayRanges(day, (ranges) => [...ranges, {}]);
  }

  function removeDayRange(day: DayKey, index: number) {
    setDayRanges(day, (ranges) => {
      const next = ranges.filter((_, i) => i !== index);
      return next.length ? next : [{}];
    });
  }

  function addTime(day: DayKey) {
    const time = newTimes[day];
    if (!time) return;
    setTask((current) => {
      if (!current) return current;
      const timesByDay: TimesByDay = asRecord(current.regularTimesByDay);
      return {
        ...current,
        regularDays: orderedDays(new Set([...(current.regularDays || []), day])),
        regularTimesByDay: { ...timesByDay, [day]: normaliseTimes([...(timesByDay[day] ?? []), time]) },
      };
    });
    setNewTimes((current) => ({ ...current, [day]: "" }));
  }

  function removeTime(day: DayKey, time: string) {
    setTask((current) => {
      if (!current) return current;
      const timesByDay: TimesByDay = { ...asRecord(current.regularTimesByDay) };
      const remaining = normaliseTimes((timesByDay[day] ?? []).filter((entry) => entry !== time));
      if (remaining.length) timesByDay[day] = remaining;
      else delete timesByDay[day];
      return { ...current, regularTimesByDay: timesByDay };
    });
  }

  async function removeTask() {
    const confirmed = await confirm({
      title: `Delete ${task?.name || "this task"}?`,
      message: "It will no longer be available on rosters. This can't be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/task-templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      removeDraftRecord(buildDraftStorageKey("task", id));
      try {
        window.sessionStorage.setItem(TASK_TEMPLATE_DELETED_STORAGE_KEY, id);
      } catch (error) {
        console.error(error);
      }
      notifyTemplatesChanged();
      invalidateWorkspaceResource("tasks");
      invalidateWorkspaceResource(taskDataKey(id));
      notify({ tone: "success", title: `${task?.name ?? "Task"} deleted` });
      const listHref = isTourTemplate(task) ? "/tours" : "/tasks";
      if (!navigateWithinSpa(listHref)) router.push(listHref);
      router.refresh();
    } catch {
      notify({ tone: "error", title: "Couldn't delete this task", message: "Please try again." });
    }
  }

  if (!task) {
    return (
      <div className="card max-w-xl p-6">
        <h1 className="text-[18px] font-semibold">Task not found</h1>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">It may have been deleted.</p>
        <SpaLink href="/tasks" className="btn mt-4">
          Back to tasks
        </SpaLink>
      </div>
    );
  }

  const isTour = isTourTemplate(task);
  const timesByDay: TimesByDay = asRecord(task.regularTimesByDay);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        breadcrumb={{ label: isTour ? "Tours" : "Tasks", href: isTour ? "/tours" : "/tasks" }}
        title={
          <span className="flex items-center gap-3">
            <span
              className="h-5 w-5 shrink-0 rounded-[6px] ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: task.color || "#fff" }}
              aria-hidden="true"
            />
            {task.name.trim() || "Untitled task"}
          </span>
        }
        meta={<SaveStatus state={saveState} />}
        actions={
          <>
            <button type="button" className="btn btn-danger" onClick={removeTask}>
              <Trash2 />
              Delete
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveNow({ mode: "manual" })}
              disabled={saveState.state === "saving" || !task.name.trim()}
            >
              <Save />
              Save
            </button>
          </>
        }
      />

      <div className="space-y-6">
        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Details</h2>
          </div>
          <div className="border-b border-[var(--border)] px-5 pt-5 pb-4">
            <p className="field-label">Type</p>
            <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--border-strong)] p-0.5" role="radiogroup">
              {([
                { label: "Task", tour: false },
                { label: "Tour", tour: true },
              ] as const).map((option) => (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={isTour === option.tour}
                  onClick={() =>
                    updateTask(
                      option.tour
                        ? { category: TOUR_CATEGORY, waitingMinutes: TOUR_WAITING_MINUTES }
                        : { category: "" }
                    )
                  }
                  className={`h-8 rounded-[6px] px-4 text-[13.5px] font-medium transition-colors ${
                    isTour === option.tour ? "bg-[var(--accent)] text-white" : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="field-hint">Tours are listed separately and always start with a {TOUR_WAITING_MINUTES}-minute waiting block.</p>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div>
              <label className="field-label" htmlFor="task-name">
                Name
              </label>
              <input
                id="task-name"
                className="input w-full"
                value={task.name}
                onChange={(event) => updateTask({ name: event.target.value })}
              />
              {!task.name.trim() && <p className="field-hint !text-[var(--danger)]">Enter a name to save changes.</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="task-color">
                Colour
              </label>
              <input
                id="task-color"
                type="color"
                className="h-9 w-full cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-white p-1"
                value={task.color || "#ffffff"}
                onChange={(event) => updateTask({ color: event.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Rules</h2>
              <p className="card-description">How autofill places this {isTour ? "tour" : "task"}.</p>
            </div>
          </div>

          {isFloorTemplate(task) && (
            <div className="border-b border-[var(--border)] bg-[var(--accent-soft)] px-5 py-3 text-[13px] leading-5 text-[#1e2a78]">
              <p className="font-medium">Floor task: autofill uses this to fill people&apos;s spare time.</p>
              <p className="mt-0.5">
                Spare time is shared out across floor tasks. Ones with a limit on{" "}
                <span className="font-medium">Most people on it at once</span> are filled first, up to that number;
                floor tasks without a limit take whatever is left. People move on to another floor task after{" "}
                <span className="font-medium">Ideal time in one go</span>.
                {task.mustManned && " Because it must be manned, one person is always on it first; spare people can join when there's room."}
              </p>
            </div>
          )}

          <RuleGroup title="Placement">
            <SettingRow
              id="enabled"
              label="Use in autofill"
              description="When off, autofill skips it. You can still add it to a roster by hand."
              checked={task.enabled !== false}
              onChange={(checked) => updateTask({ enabled: checked })}
            />
            <SettingRow
              id="must-manned"
              label="Must be manned"
              description="At least one person is on this for the whole time it runs. More can join if there's spare time."
              checked={!!task.mustManned}
              onChange={(checked) => updateTask({ mustManned: checked })}
            />
            <SettingRow
              id="attended-by-all"
              label="Everyone attends"
              description="Everyone working at that time gets it together, like a briefing."
              checked={!!task.attendedByAll}
              onChange={(checked) => updateTask({ attendedByAll: checked })}
            />
            <SettingRow
              id="overwrite"
              label="Takes priority"
              description="Placed over other tasks that are in its way, instead of only in free time."
              checked={!!task.overwriteExistingTasks}
              onChange={(checked) => updateTask({ overwriteExistingTasks: checked })}
            />
            {isTour && (
              <SettingRow
                id="school-tour-target"
                label="Use for imported school tours"
                description="Imported school tours are placed as this tour. Only one tour can be used for this."
                checked={!!task.schoolTourImportTarget}
                onChange={(checked) => updateTask({ schoolTourImportTarget: checked })}
              />
            )}
            <SettingRow
              id="paired-with"
              label="Goes with another task"
              description="Autofill places this straight before or after every block of that task, for the same person, instead of on its own."
              checked={!!task.pairedWithTaskId}
              onChange={(checked) =>
                updateTask({
                  pairedWithTaskId: checked ? task.pairedWithTaskId || otherTasks[0]?.id || "" : "",
                  pairedPosition: task.pairedPosition || "after",
                })
              }
            >
              <div className="flex flex-wrap gap-2">
                <select
                  id="paired-position"
                  aria-label="Before or after"
                  className="input w-[160px]"
                  value={task.pairedPosition === "before" ? "before" : "after"}
                  onChange={(event) => updateTask({ pairedPosition: event.target.value === "before" ? "before" : "after" })}
                >
                  <option value="after">Straight after</option>
                  <option value="before">Straight before</option>
                </select>
                <select
                  id="paired-task"
                  aria-label="Task it goes with"
                  className="input min-w-[200px] flex-1"
                  value={task.pairedWithTaskId || ""}
                  onChange={(event) => updateTask({ pairedWithTaskId: event.target.value })}
                >
                  {!otherTasks.some((entry) => entry.id === task.pairedWithTaskId) && (
                    <option value={task.pairedWithTaskId || ""}>{task.pairedWithTaskId ? "Loading…" : "Choose a task"}</option>
                  )}
                  {otherTasks.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-[13px] text-[var(--text-muted)]">
                It lasts its fixed time, or its ideal time in one go if it has no fixed time.
              </p>
            </SettingRow>
          </RuleGroup>

          <RuleGroup title="Length">
            <SettingRow
              id="fixed-time"
              label="Fixed time"
              description="Each block lasts a set time instead of filling the gap it's placed in."
              checked={(Number(task.durationMinutes) || 0) > 0}
              onChange={toggleMinutes("durationMinutes", DEFAULT_FIXED_MINUTES)}
            >
              <MinutesSelect
                id="fixed-time-length"
                value={Number(task.durationMinutes) || DEFAULT_FIXED_MINUTES}
                onChange={(minutes) => updateTask({ durationMinutes: minutes })}
              />
            </SettingRow>
            {isTour ? (
              <div className="px-5 py-4">
                <p className="text-[14px] font-medium">Waiting for beforehand</p>
                <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                  Always {TOUR_WAITING_MINUTES} minutes for tours.
                </p>
              </div>
            ) : (
              <SettingRow
                id="waiting-beforehand"
                label="Waiting for beforehand"
                description="Adds a “Waiting for” block before it starts."
                checked={(Number(task.waitingMinutes) || 0) > 0}
                onChange={toggleMinutes("waitingMinutes", DEFAULT_BUFFER_MINUTES)}
              >
                <MinutesSelect
                  id="waiting-length"
                  value={Number(task.waitingMinutes) || DEFAULT_BUFFER_MINUTES}
                  onChange={(minutes) => updateTask({ waitingMinutes: minutes })}
                />
              </SettingRow>
            )}
            {(isTour || (Number(task.waitingMinutes) || 0) > 0) && (
              <SettingRow
                id="waiting-covered"
                label="Waiting time can be covered"
                description="If nobody is free for the waiting time, an everyone-attends task (like a briefing) or the only person on a must-be-manned task (like Front Desk) stays on it, and this starts at its set time."
                checked={!!task.waitingCanBeCovered}
                onChange={(checked) => updateTask({ waitingCanBeCovered: checked })}
              />
            )}
            <SettingRow
              id="packing-up"
              label="Packing up"
              description="Adds a “Packing up” block after it ends."
              checked={(Number(task.packingMinutes) || 0) > 0}
              onChange={toggleMinutes("packingMinutes", DEFAULT_BUFFER_MINUTES)}
            >
              <MinutesSelect
                id="packing-length"
                value={Number(task.packingMinutes) || DEFAULT_BUFFER_MINUTES}
                onChange={(minutes) => updateTask({ packingMinutes: minutes })}
              />
            </SettingRow>
            {(Number(task.durationMinutes) || 0) > 0 ? (
              <SettingRow
                id="max-consecutive"
                label="Limit time in one go"
                description="The longest one person does it back to back before switching to something else."
                checked={(Number(task.maxConsecutiveMinutes) || 0) > 0}
                onChange={toggleMinutes("maxConsecutiveMinutes", DEFAULT_FIXED_MINUTES)}
              >
                <MinutesSelect
                  id="max-consecutive-length"
                  value={Number(task.maxConsecutiveMinutes) || DEFAULT_FIXED_MINUTES}
                  onChange={(minutes) => updateTask({ maxConsecutiveMinutes: minutes })}
                />
              </SettingRow>
            ) : (
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <label htmlFor="max-consecutive-length" className="block text-[14px] font-medium">
                    Ideal time in one go
                  </label>
                  <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                    Autofill moves people on to something else after this long. Cover can run over if nobody else is
                    free.
                  </p>
                </div>
                <MinutesSelect
                  id="max-consecutive-length"
                  value={Number(task.maxConsecutiveMinutes) || DEFAULT_IDEAL_STINT_MINUTES}
                  onChange={(minutes) => updateTask({ maxConsecutiveMinutes: minutes })}
                />
              </div>
            )}
          </RuleGroup>

          <RuleGroup title="How often" description="Leave blank for no limit.">
            <div className="grid gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-2">
              <CountRule
                id="min-per-person"
                label="At least, per person each day"
                value={task.minPerEmployeePerDay}
                placeholder="None"
                onChange={(value) => updateTask({ minPerEmployeePerDay: value })}
              />
              <CountRule
                id="max-per-person"
                label="At most, per person each day"
                value={task.maxPerEmployeePerDay}
                onChange={(value) => updateTask({ maxPerEmployeePerDay: value })}
              />
              <CountRule
                id="limit-per-day"
                label="At most, in total each day"
                value={task.limitPerDay}
                onChange={(value) => updateTask({ limitPerDay: value })}
              />
              <CountRule
                id="max-at-once"
                label="Most people on it at once"
                value={task.maxConcurrentPerTimeslot}
                onChange={(value) => updateTask({ maxConcurrentPerTimeslot: value })}
              />
            </div>
          </RuleGroup>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">When it happens</h2>
              <p className="card-description">
                Tick the days it runs. Add set start times for appointments, or time ranges if it can happen any
                time within them. With more than one range (say 10:00–12:00 and 14:00–16:00), it never runs in the
                gap between.
              </p>
            </div>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {DAY_KEYS.map((day) => {
              const active = (task.regularDays || []).includes(day);
              const times = normaliseTimes(timesByDay[day] ?? []);
              const ranges = dayRanges(task, day);
              return (
                <li key={day} className="px-5 py-3">
                  <label className="flex w-fit items-center gap-2.5 text-[14px] font-medium">
                    <input type="checkbox" checked={active} onChange={(event) => toggleDay(day, event.target.checked)} />
                    {DAY_LABELS[day]}
                  </label>
                  {active && (
                    <div className="mt-3 grid gap-4 pl-[26px] md:grid-cols-2">
                      <div>
                        <p className="mb-1.5 text-[12.5px] font-medium text-[var(--text-muted)]">Set start times</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {times.map((time) => (
                            <span
                              key={time}
                              className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] pl-2.5 pr-1 text-[13px] font-medium tabular-nums"
                            >
                              {time}
                              <button
                                type="button"
                                className="grid h-6 w-6 place-items-center rounded text-[var(--text-muted)] hover:bg-white hover:text-[var(--text)]"
                                onClick={() => removeTime(day, time)}
                                aria-label={`Remove ${time} on ${DAY_LABELS[day]}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                          <form
                            className="flex items-center gap-1.5"
                            onSubmit={(event) => {
                              event.preventDefault();
                              addTime(day);
                            }}
                          >
                            <input
                              type="time"
                              className="input time-input-no-icon h-8 w-[100px] px-2 text-[13px]"
                              value={newTimes[day] || ""}
                              onChange={(event) => setNewTimes((current) => ({ ...current, [day]: event.target.value }))}
                              aria-label={`New start time on ${DAY_LABELS[day]}`}
                            />
                            <button type="submit" className="btn btn-sm" disabled={!newTimes[day]}>
                              <Plus />
                              Add
                            </button>
                          </form>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-[12.5px] font-medium text-[var(--text-muted)]">Time ranges</p>
                        <div className="flex flex-col gap-1.5">
                          {ranges.map((range, index) => (
                            <div key={index} className="flex items-center gap-1.5">
                              <input
                                type="time"
                                className="input time-input-no-icon h-8 w-[100px] px-2 text-[13px]"
                                value={range.start || ""}
                                onChange={(event) => updateDayRange(day, index, "start", event.target.value)}
                                aria-label={`${DAY_LABELS[day]} range ${index + 1} start`}
                              />
                              <span className="text-[12px] text-[var(--text-muted)]">to</span>
                              <input
                                type="time"
                                className="input time-input-no-icon h-8 w-[100px] px-2 text-[13px]"
                                value={range.end || ""}
                                onChange={(event) => updateDayRange(day, index, "end", event.target.value)}
                                aria-label={`${DAY_LABELS[day]} range ${index + 1} end`}
                              />
                              {(ranges.length > 1 || range.start || range.end) && (
                                <button
                                  type="button"
                                  className="grid h-8 w-8 place-items-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
                                  onClick={() => removeDayRange(day, index)}
                                  aria-label={`Remove ${DAY_LABELS[day]} range ${index + 1}`}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button type="button" className="btn btn-sm w-fit" onClick={() => addDayRange(day)}>
                            <Plus />
                            Add range
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
