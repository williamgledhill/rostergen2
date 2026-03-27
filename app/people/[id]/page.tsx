"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Copy, PencilLine, Save, Trash2 } from "lucide-react";
import {
  ALL_DAYS,
  type DayKey,
  type DaySchedule,
  type FortnightSchedule,
  type FortnightWeekKey,
  type Person,
  ensureFortnightSchedule,
} from "@/lib/people";

const DAY_ROWS: { key: DayKey; label: string }[] = [
  { key: "Mon", label: "Monday" },
  { key: "Tue", label: "Tuesday" },
  { key: "Wed", label: "Wednesday" },
  { key: "Thu", label: "Thursday" },
  { key: "Fri", label: "Friday" },
  { key: "Sat", label: "Saturday" },
  { key: "Sun", label: "Sunday" },
];

type PersonEditor = Omit<Person, "fortnight"> & { fortnight: FortnightSchedule };
type WeekKey = "weekA" | "weekB";
type WeekOption = { key: WeekKey; label: string };

const WEEK_OPTIONS: WeekOption[] = [
  { key: "weekA", label: "Week A" },
  { key: "weekB", label: "Week B" },
];

function formatTitle(name: string) {
  return `${name}'s default hours`;
}

function cloneWeek(week: Record<DayKey, DaySchedule>) {
  const next = {} as Record<DayKey, DaySchedule>;
  ALL_DAYS.forEach((day) => {
    next[day] = { ...week[day] };
  });
  return next;
}

function toEditorPerson(raw: Person): PersonEditor {
  const fortnight = ensureFortnightSchedule(raw);
  return {
    ...raw,
    schedule: cloneWeek(fortnight.weekA),
    fortnight,
  };
}

function WeekDayEditor({
  label,
  schedule,
  onToggle,
  onChangeStart,
  onChangeEnd,
}: {
  label: string;
  schedule: DaySchedule;
  onToggle: () => void;
  onChangeStart: (value: string) => void;
  onChangeEnd: (value: string) => void;
}) {
  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-[12px] font-semibold text-slate-700">
          <input type="checkbox" checked={schedule.enabled} onChange={onToggle} />
          {label}
        </label>
        <span className={`text-[11px] font-semibold ${schedule.enabled ? "text-emerald-700" : "text-slate-500"}`}>
          {schedule.enabled ? "Working" : "Off"}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
        <input
          type="time"
          className="input time-input-no-icon h-8 w-full min-w-0 px-2 text-[13px]"
          value={schedule.start}
          onChange={(event) => onChangeStart(event.target.value)}
          disabled={!schedule.enabled}
        />
        <span className="text-xs text-slate-500">to</span>
        <input
          type="time"
          className="input time-input-no-icon h-8 w-full min-w-0 px-2 text-[13px]"
          value={schedule.end}
          onChange={(event) => onChangeEnd(event.target.value)}
          disabled={!schedule.enabled}
        />
      </div>
    </div>
  );
}

export default function PersonDetail() {
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id;

  const [person, setPerson] = useState<PersonEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function load(targetId: string) {
      try {
        const res = await fetch(`/api/people?id=${targetId}`);
        if (!res.ok) throw new Error("Not found");
        const data = (await res.json()) as Person;
        if (active) setPerson(toEditorPerson(data));
      } catch (err) {
        console.error(err);
        if (active) setPerson(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    if (id) {
      load(id);
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [id]);

  function updateDay(week: WeekKey, day: DayKey, patch: Partial<DaySchedule>) {
    setPerson((prev) => {
      if (!prev) return prev;
      const current = prev.fortnight[week][day];
      const nextDay = { ...current, ...patch };
      return {
        ...prev,
        fortnight: {
          ...prev.fortnight,
          [week]: {
            ...prev.fortnight[week],
            [day]: nextDay,
          },
        },
      };
    });
    setNotice("");
  }

  function copyWeek(from: WeekKey, to: WeekKey) {
    setPerson((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fortnight: {
          ...prev.fortnight,
          [to]: cloneWeek(prev.fortnight[from]),
        },
      };
    });
    setNotice(`${from === "weekA" ? "Week A" : "Week B"} copied to ${to === "weekA" ? "Week A" : "Week B"}.`);
  }

  async function save() {
    if (!person) return;
    setSaving(true);
    setNotice("");
    try {
      const payload: Person = {
        ...person,
        schedule: cloneWeek(person.fortnight.weekA),
        fortnight: person.fortnight,
      };
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      const saved = (await res.json()) as Person;
      setPerson(toEditorPerson(saved));
      setNotice("Saved.");
    } catch (err) {
      console.error(err);
      setNotice("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function removePerson() {
    if (!id) return;
    if (!confirm("Delete this employee?")) return;
    try {
      const res = await fetch(`/api/people?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      router.push("/people");
    } catch (err) {
      console.error(err);
      setNotice("Failed to delete.");
    }
  }

  function renamePerson() {
    const name = prompt("Rename employee", person?.name ?? "");
    if (!name || !person) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setPerson((prev) => (prev ? { ...prev, name: trimmed } : prev));
    setNotice("");
  }

  if (loading) {
    return (
      <div className="w-full px-1 py-2 sm:px-2 sm:py-3 md:px-3 md:py-4">
        <p className="text-slate-700">Loading...</p>
      </div>
    );
  }

  if (!id || !person) {
    return (
      <div className="w-full px-1 py-2 sm:px-2 sm:py-3 md:px-3 md:py-4">
        <div className="card p-4">
          <p className="text-slate-700">Employee not found.</p>
          <button className="btn mt-3" onClick={() => router.push("/people")}>
            Back to people
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-1 py-2 sm:px-2 sm:py-3 md:px-3 md:py-4">
      <div className="space-y-4">
        <div className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{formatTitle(person.name)}</h1>
              <p className="text-sm text-slate-600">Adjust a fortnight schedule for {person.name}.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn" onClick={() => router.push("/people")}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button className="btn" onClick={renamePerson}>
                <PencilLine className="h-4 w-4" />
                Rename
              </button>
              <button
                className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[var(--radius-md)] border border-red-300 bg-white px-3 text-[13px] font-medium text-red-700 transition hover:bg-red-600 hover:text-white"
                onClick={removePerson}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          {notice && <p className="mt-2 text-sm text-slate-600">{notice}</p>}
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Fortnight Schedule</h2>
                <p className="text-sm text-slate-600">Set both weeks in one view. Weeks alternate every 7 days.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Cycle start</label>
                <input
                  type="date"
                  className="input h-9 w-[150px] text-[13px]"
                  value={person.fortnight.anchorDate}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPerson((prev) =>
                      prev
                        ? {
                            ...prev,
                            fortnight: {
                              ...prev.fortnight,
                              anchorDate: value,
                            },
                          }
                        : prev
                    );
                    setNotice("");
                  }}
                />
                <button className="btn h-9 whitespace-nowrap" onClick={() => copyWeek("weekA", "weekB")}>
                  <Copy className="h-4 w-4" />
                  Copy A to B
                </button>
                <button className="btn h-9 whitespace-nowrap" onClick={() => copyWeek("weekB", "weekA")}>
                  <Copy className="h-4 w-4" />
                  Copy B to A
                </button>
              </div>
            </div>
          </div>

          <div className="p-3 sm:p-4">
            <div className="hidden grid-cols-[130px_1fr_1fr] gap-2 px-1 pb-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 md:grid">
              <div>Day</div>
              {WEEK_OPTIONS.map((week) => (
                <div key={week.key}>{week.label}</div>
              ))}
            </div>

            <div className="space-y-2">
              {DAY_ROWS.map(({ key, label }) => (
                <div key={key} className="rounded-[10px] border border-[var(--border)] bg-white px-2 py-2 sm:px-3">
                  <div className="grid gap-2 md:grid-cols-[130px_1fr_1fr] md:items-center">
                    <div className="px-1 text-[15px] font-semibold text-slate-800">{label}</div>
                    {WEEK_OPTIONS.map((week) => {
                      const sched = person.fortnight[week.key][key];
                      return (
                        <WeekDayEditor
                          key={`${key}-${week.key}`}
                          label={week.label}
                          schedule={sched}
                          onToggle={() => updateDay(week.key, key, { enabled: !sched.enabled })}
                          onChangeStart={(value) => updateDay(week.key, key, { start: value })}
                          onChangeEnd={(value) => updateDay(week.key, key, { end: value })}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
