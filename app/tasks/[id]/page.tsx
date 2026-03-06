"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, notFound, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { TaskTemplate } from "@/lib/taskTemplates";

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

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const [task, setTask] = useState<TaskTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTimeSlot, setNewTimeSlot] = useState("");
  const [newDayTimeSlots, setNewDayTimeSlots] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    async function load(targetId: string) {
      try {
        const res = await fetch(`/api/task-templates?id=${targetId}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        if (active) setTask(data);
      } catch (err) {
        console.error(err);
        if (active) setTask(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) load(id);
    else setLoading(false);
    return () => { active = false; };
  }, [id]);

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
      return {
        ...t,
        regularDayWindows: { ...current, [dayKey]: { ...dayWindow, [field]: value } },
      };
    });
  }

  function toggleAllDays(checked: boolean) {
    setTask((t) => {
      if (!t) return t;
      return { ...t, regularDays: checked ? REGULAR_DAYS.map((d) => d.key) : [] };
    });
  }

  function addTimeSlot() {
    if (!newTimeSlot) return;
    setTask((t) => {
      if (!t) return t;
      const current = Array.isArray(t.regularTimes) ? t.regularTimes : [];
      const next = Array.from(new Set([...current, newTimeSlot])).sort();
      return { ...t, regularTimes: next };
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
      const nextDayTimes = Array.from(new Set([...dayTimes, slot])).sort();
      return {
        ...t,
        regularTimesByDay: { ...current, [dayKey]: nextDayTimes },
      };
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
      return {
        ...t,
        regularTimesByDay: { ...current, [dayKey]: dayTimes.filter((s) => s !== slot) },
      };
    });
  }

  async function save() {
    if (!task) return;
    try {
      const res = await fetch('/api/task-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });
      if (!res.ok) throw new Error('Failed to save');
      alert('Saved');
    } catch (err) {
      console.error(err);
      alert('Failed to save');
    }
  }

  async function removeTask() {
    if (!id) return;
    if (!confirm("Delete this task? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/task-templates?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.push("/tasks");
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  }

  if (loading) {
    return <div className="w-full py-4 px-3"><p className="text-slate-700">Loading...</p></div>;
  }
  if (!id) return notFound();
  if (!task) return notFound();

  return (
    <div className="w-full py-3 px-3">
      <div className="space-y-3 flex flex-col items-start w-full max-w-5xl mx-auto">
        <div className="flex items-center gap-1 text-[14px]">
          <Link href="/tasks" className="text-[#675dff] font-semibold hover:underline">
            Tasks
          </Link>
          <ChevronRight className="w-4 h-4 text-slate-700" />
          <span className="text-slate-600 font-medium">{task.name || "Task"}</span>
        </div>
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col leading-tight">
            <h1 className="text-2xl font-semibold">{task.name || "Task"}</h1>
            <p className="text-slate-600 text-[14px]">
              Configure settings for {task.name || "this task"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn h-9"
              style={{ borderRadius: "6px", borderColor: "#f3b7b7", color: "#b91c1c" }}
              onClick={removeTask}
            >
              Delete
            </button>
            <button
              className="btn btn-primary h-9"
              style={{ borderRadius: "6px", paddingInline: "12px" }}
              onClick={save}
            >
              <span className="text-[14px] font-medium text-white">Save</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm w-full">
          <div className="py-4 space-y-6 text-[14px]" style={{ color: "#1A1B25" }}>
            <div className="space-y-1">
              <label className="block text-sm font-semibold mb-1">Name</label>
              <input
                className="input w-full text-[14px]"
                value={task.name}
                onChange={(e) => setTask((t) => (t ? { ...t, name: e.target.value } : t))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-[720px]">
              <div className="space-y-1">
                <label className="block text-sm font-semibold">Colour</label>
                <input
                  type="color"
                  className="h-[36px] w-[120px] p-1 border border-slate-300 rounded-md bg-white"
                  value={task.color || "#ffffff"}
                  onChange={(e) => setTask((t) => (t ? { ...t, color: e.target.value } : t))}
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-semibold">Length</label>
                <select
                  className="input w-[180px] text-[14px]"
                  value={Number.isFinite(task.durationMinutes) ? task.durationMinutes : 0}
                  onChange={(e) =>
                    setTask((t) =>
                      t ? { ...t, durationMinutes: Number(e.target.value) } : t
                    )
                  }
                >
                  <option value={0}>Not set</option>
                  {DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutes
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-semibold">Max consecutive time</label>
                <select
                  className="input w-[180px] text-[14px]"
                  value={Number.isFinite(task.maxConsecutiveMinutes) ? task.maxConsecutiveMinutes : 0}
                  onChange={(e) =>
                    setTask((t) =>
                      t ? { ...t, maxConsecutiveMinutes: Number(e.target.value) } : t
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
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-[720px]">
              <div className="border border-[var(--border)] rounded-md px-3 py-2 space-y-2">
                <label className="block text-sm font-semibold">Enabled</label>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={task.enabled !== false}
                      onChange={(e) =>
                        setTask((t) =>
                          t ? { ...t, enabled: e.target.checked } : t
                        )
                      }
                    />
                    <span className="w-11 h-6 rounded-full bg-slate-200 transition peer-checked:bg-[#675dff]" />
                    <span className="absolute left-[2px] top-[2px] w-5 h-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                  </label>
                  <span className="text-[12px] text-slate-500">Include in autofill</span>
                </div>
              </div>
              <div className="border border-[var(--border)] rounded-md px-3 py-2 space-y-2">
                <label className="block text-sm font-semibold">Waiting for</label>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={(task.waitingMinutes || 0) > 0}
                      onChange={(e) =>
                        setTask((t) =>
                          t ? { ...t, waitingMinutes: e.target.checked ? 15 : 0 } : t
                        )
                      }
                    />
                    <span className="w-11 h-6 rounded-full bg-slate-200 transition peer-checked:bg-[#675dff]" />
                    <span className="absolute left-[2px] top-[2px] w-5 h-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                  </label>
                  <span className="text-[12px] text-slate-500">Adds 15 minutes before</span>
                </div>
              </div>
              <div className="border border-[var(--border)] rounded-md px-3 py-2 space-y-2">
                <label className="block text-sm font-semibold">Packing up</label>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={(task.packingMinutes || 0) > 0}
                      onChange={(e) =>
                        setTask((t) =>
                          t ? { ...t, packingMinutes: e.target.checked ? 15 : 0 } : t
                        )
                      }
                    />
                    <span className="w-11 h-6 rounded-full bg-slate-200 transition peer-checked:bg-[#675dff]" />
                    <span className="absolute left-[2px] top-[2px] w-5 h-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                  </label>
                  <span className="text-[12px] text-slate-500">Adds 15 minutes after</span>
                </div>
              </div>
              <div className="border border-[var(--border)] rounded-md px-3 py-2 space-y-2">
                <label className="block text-sm font-semibold">Must always be manned</label>
                <div className="flex items-center gap-3">
                  <label htmlFor="must-manned" className="relative inline-flex items-center cursor-pointer">
                    <input
                      id="must-manned"
                      type="checkbox"
                      className="sr-only peer"
                      checked={!!task.mustManned}
                      onChange={(e) => setTask((t) => (t ? { ...t, mustManned: e.target.checked } : t))}
                    />
                    <span className="w-11 h-6 rounded-full bg-slate-200 transition peer-checked:bg-[#675dff]" />
                    <span className="absolute left-[2px] top-[2px] w-5 h-5 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
                  </label>
                  <span className="text-[12px] text-slate-500">Autofill preset</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-[var(--border)]">
              <div>
                <label className="block text-sm font-semibold mb-1">Default time slots</label>
                <p className="text-[12px] text-slate-500 mb-2">
                  These can be added without enabling any regularity days.
                </p>
                <div className="flex flex-wrap items-center gap-2 max-w-[520px]">
                  <input
                    type="time"
                    className="input w-[140px] text-[14px]"
                    value={newTimeSlot}
                    onChange={(e) => setNewTimeSlot(e.target.value)}
                  />
                  <button className="btn h-8 px-3" type="button" onClick={addTimeSlot}>
                    Add time
                  </button>
                </div>
                {(task.regularTimes || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2 max-w-[520px]">
                    {(task.regularTimes || []).map((slot) => (
                      <span
                        key={slot}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-2 py-1 text-[12px] text-slate-700"
                      >
                        {slot}
                        <button
                          type="button"
                          className="text-slate-500 hover:text-slate-700"
                          onClick={() => removeTimeSlot(slot)}
                          aria-label={`Remove ${slot}`}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Regularity</label>
                <div className="border border-[var(--border)] rounded-md divide-y divide-[var(--border)] max-w-[520px] overflow-hidden">
                  <div className="grid grid-cols-[140px,120px,120px] gap-3 px-3 py-2 text-[12px] text-slate-500 bg-[var(--surface-subtle)]">
                    <label className="inline-flex items-center gap-2 font-medium text-slate-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={REGULAR_DAYS.every((d) => (task.regularDays || []).includes(d.key))}
                        onChange={(e) => toggleAllDays(e.target.checked)}
                        style={{ accentColor: "rgb(103, 93, 255)" }}
                      />
                      <span>All days</span>
                    </label>
                    <span>From</span>
                    <span>To</span>
                  </div>
                  {REGULAR_DAYS.map((day) => {
                    const checked = (task.regularDays || []).includes(day.key);
                    const dayWindow = task.regularDayWindows?.[day.key] || {};
                    return (
                      <div key={day.key} className="grid grid-cols-[140px,120px,120px] items-center gap-3 px-3 py-3">
                        <label className="flex items-center gap-2 text-sm font-semibold">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={checked}
                            onChange={() => toggleRegularDay(day.key)}
                            style={{ accentColor: "rgb(103, 93, 255)" }}
                          />
                          <span>{day.label}</span>
                        </label>
                        <input
                          type="time"
                          className="input text-[14px] w-[120px]"
                          value={dayWindow.start || ""}
                          onChange={(e) => updateDayWindow(day.key, "start", e.target.value)}
                          disabled={!checked}
                          aria-label={`${day.label} start time`}
                        />
                        <input
                          type="time"
                          className="input text-[14px] w-[120px]"
                          value={dayWindow.end || ""}
                          onChange={(e) => updateDayWindow(day.key, "end", e.target.value)}
                          disabled={!checked}
                          aria-label={`${day.label} end time`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Time slots by day</label>
                <p className="text-[12px] text-slate-500 mb-3">
                  Overrides the default time slots for a specific day.
                </p>
                <div className="space-y-2 max-w-[720px]">
                  {REGULAR_DAYS.map((day) => {
                    const dayTimes = Array.isArray(task.regularTimesByDay?.[day.key])
                      ? task.regularTimesByDay?.[day.key] || []
                      : [];
                    return (
                      <div
                        key={day.key}
                        className="border border-[var(--border)] rounded-md px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold">{day.label}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              className="input w-[140px] text-[14px]"
                              value={newDayTimeSlots[day.key] || ""}
                              onChange={(e) =>
                                setNewDayTimeSlots((prev) => ({ ...prev, [day.key]: e.target.value }))
                              }
                            />
                            <button
                              className="btn h-8 px-3"
                              type="button"
                              onClick={() => addDayTimeSlot(day.key)}
                              disabled={!newDayTimeSlots[day.key]}
                            >
                              Add time
                            </button>
                          </div>
                        </div>
                        {dayTimes.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {dayTimes.map((slot) => (
                              <span
                                key={`${day.key}-${slot}`}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-2 py-1 text-[12px] text-slate-700"
                              >
                                {slot}
                                <button
                                  type="button"
                                  className="text-slate-500 hover:text-slate-700"
                                  onClick={() => removeDayTimeSlot(day.key, slot)}
                                  aria-label={`Remove ${slot} on ${day.label}`}
                                >
                                  x
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-[720px]">
                <div>
                  <label className="block text-sm font-semibold mb-2">Minimum per employee per day</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input w-[120px] text-[14px]"
                      value={Number.isFinite(task.minPerEmployeePerDay) ? task.minPerEmployeePerDay : 0}
                      onChange={(e) =>
                        setTask((t) =>
                          t
                            ? {
                                ...t,
                                minPerEmployeePerDay: Math.max(0, Number(e.target.value || 0)),
                              }
                            : t
                        )
                      }
                    />
                    <span className="text-[12px] text-slate-500">times</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Maximum per employee per day</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input w-[120px] text-[14px]"
                      value={Number.isFinite(task.maxPerEmployeePerDay) ? task.maxPerEmployeePerDay : 0}
                      onChange={(e) =>
                        setTask((t) =>
                          t
                            ? {
                                ...t,
                                maxPerEmployeePerDay: Math.max(0, Number(e.target.value || 0)),
                              }
                            : t
                        )
                      }
                    />
                    <span className="text-[12px] text-slate-500">times</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Limit per day</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input w-[120px] text-[14px]"
                      value={Number.isFinite(task.limitPerDay) ? task.limitPerDay : 0}
                      onChange={(e) =>
                        setTask((t) =>
                          t
                            ? {
                                ...t,
                                limitPerDay: Math.max(0, Number(e.target.value || 0)),
                              }
                            : t
                        )
                      }
                    />
                    <span className="text-[12px] text-slate-500">times</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

