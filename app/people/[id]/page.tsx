"use client";

import React, { useEffect, useMemo, useState } from "react";
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

export default function PersonDetail() {
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id;

  const [person, setPerson] = useState<PersonEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeWeek, setActiveWeek] = useState<FortnightWeekKey>("weekA");
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

  const activeWeekLabel = activeWeek === "weekA" ? "Week A" : "Week B";
  const copyTarget = activeWeek === "weekA" ? "Week B" : "Week A";

  function updateDay(day: DayKey, patch: Partial<DaySchedule>) {
    setPerson((prev) => {
      if (!prev) return prev;
      const current = prev.fortnight[activeWeek][day];
      const nextDay = { ...current, ...patch };
      return {
        ...prev,
        fortnight: {
          ...prev.fortnight,
          [activeWeek]: {
            ...prev.fortnight[activeWeek],
            [day]: nextDay,
          },
        },
      };
    });
    setNotice("");
  }

  function copyWeekToOther() {
    setPerson((prev) => {
      if (!prev) return prev;
      const targetWeek: FortnightWeekKey = activeWeek === "weekA" ? "weekB" : "weekA";
      return {
        ...prev,
        fortnight: {
          ...prev.fortnight,
          [targetWeek]: cloneWeek(prev.fortnight[activeWeek]),
        },
      };
    });
    setNotice(`${activeWeekLabel} copied to ${copyTarget}.`);
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

  const currentWeekSchedule = useMemo(() => person?.fortnight[activeWeek] ?? null, [person, activeWeek]);

  if (loading) {
    return (
      <div className="w-full px-1 py-2 sm:px-2 sm:py-3 md:px-3 md:py-4">
        <p className="text-slate-700">Loading...</p>
      </div>
    );
  }

  if (!id || !person || !currentWeekSchedule) {
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Fortnight Schedule</h2>
                <p className="text-sm text-slate-600">Week A and Week B alternate every 7 days from cycle start.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Cycle start</label>
                <input
                  type="date"
                  className="input h-9 text-[13px]"
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

                <div className="inline-flex overflow-hidden rounded-[10px] border border-[var(--border)] bg-white">
                  <button
                    className={`h-9 px-3 text-sm font-semibold ${activeWeek === "weekA" ? "bg-[var(--accent)] text-white" : "text-slate-700 hover:bg-slate-50"}`}
                    onClick={() => setActiveWeek("weekA")}
                  >
                    Week A
                  </button>
                  <button
                    className={`h-9 border-l border-[var(--border)] px-3 text-sm font-semibold ${activeWeek === "weekB" ? "bg-[var(--accent)] text-white" : "text-slate-700 hover:bg-slate-50"}`}
                    onClick={() => setActiveWeek("weekB")}
                  >
                    Week B
                  </button>
                </div>

                <button className="btn h-9" onClick={copyWeekToOther}>
                  <Copy className="h-4 w-4" />
                  Copy to {copyTarget}
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-clean min-w-[760px]">
              <thead>
                <tr>
                  <th className="w-[190px]">Day</th>
                  <th className="w-[120px] text-center">Working</th>
                  <th className="w-[170px] text-center">Start</th>
                  <th className="w-[170px] text-center">End</th>
                </tr>
              </thead>
              <tbody>
                {DAY_ROWS.map(({ key, label }) => {
                  const sched = currentWeekSchedule[key];
                  return (
                    <tr key={key}>
                      <td className="font-semibold text-slate-800">{label}</td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={sched.enabled}
                          onChange={() => updateDay(key, { enabled: !sched.enabled })}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="time"
                          className="input h-9 w-[140px] text-sm"
                          value={sched.start}
                          onChange={(event) => updateDay(key, { start: event.target.value })}
                          disabled={!sched.enabled}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="time"
                          className="input h-9 w-[140px] text-sm"
                          value={sched.end}
                          onChange={(event) => updateDay(key, { end: event.target.value })}
                          disabled={!sched.enabled}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
