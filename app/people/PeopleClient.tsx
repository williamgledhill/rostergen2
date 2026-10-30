"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { useFeedback } from "@/components/ui/Feedback";
import PageHeader from "@/components/ui/PageHeader";
import { ALL_DAYS, type DayKey, type DaySchedule, type Person, defaultSchedule } from "@/lib/people";
import { DAY_LABELS } from "@/lib/settingsDefaults";
import { navigateWithinSpa } from "@/lib/spaNavigation";
import { preloadWorkspaceRoute, upsertCachedPerson } from "@/lib/workspaceData";

function weeksDiffer(person: Person) {
  const fortnight = person.fortnight;
  if (!fortnight) return false;
  return ALL_DAYS.some((day) => {
    const a = fortnight.weekA[day];
    const b = fortnight.weekB[day];
    return a.enabled !== b.enabled || a.start !== b.start || a.end !== b.end;
  });
}

function WorkingDays({ person }: { person: Person }) {
  const weekA = person.fortnight?.weekA ?? person.schedule;
  const weekB = person.fortnight?.weekB ?? person.schedule;
  return (
    <div className="flex items-center gap-1" aria-label="Working days">
      {ALL_DAYS.map((day) => {
        const inA = weekA[day]?.enabled;
        const inB = weekB[day]?.enabled;
        const title = `${DAY_LABELS[day]}: ${inA && inB ? "working" : inA || inB ? "alternate weeks" : "off"}`;
        return (
          <span
            key={day}
            title={title}
            className={`grid h-6 w-6 place-items-center rounded-[6px] text-[11px] font-semibold ${
              inA && inB
                ? "bg-[var(--accent)] text-white"
                : inA || inB
                  ? "text-[#1e2a78] ring-1 ring-inset ring-[var(--accent)]"
                  : "bg-[var(--surface-muted)] text-[var(--text-faint)]"
            }`}
            // Days worked only in one week of the fortnight are half filled on the diagonal.
            style={
              inA !== inB
                ? { background: "linear-gradient(135deg, #8595f2 0 50%, var(--accent-soft) 50% 100%)" }
                : undefined
            }
          >
            {day[0]}
            <span className="sr-only">{title}</span>
          </span>
        );
      })}
    </div>
  );
}

const emptyForm = (): Person => ({ id: "", name: "", schedule: defaultSchedule([]) });

export default function PeopleClient({ initialPeople }: { initialPeople: Person[] }) {
  const [people, setPeople] = useState<Person[]>(initialPeople);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<Person>(emptyForm);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { notify } = useFeedback();

  useEffect(() => {
    setPeople(initialPeople);
  }, [initialPeople]);

  const openPerson = (id: string) => {
    const href = `/people/${id}`;
    if (!navigateWithinSpa(href)) router.push(href);
  };

  function updateDay(day: DayKey, patch: Partial<DaySchedule>) {
    setForm((prev) => ({ ...prev, schedule: { ...prev.schedule, [day]: { ...prev.schedule[day], ...patch } } }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: Person = {
      ...form,
      id: form.id || Date.now().toString(),
      name: form.name.trim(),
    };
    if (!payload.name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Failed to save");
      const saved = (await res.json()) as Person;
      setPeople((prev) =>
        prev.some((p) => p.id === saved.id) ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]
      );
      upsertCachedPerson(saved);
      setDialogOpen(false);
      notify({ tone: "success", title: `${saved.name} added` });
    } catch (err) {
      notify({ tone: "error", title: "Couldn't add this person", message: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="People"
        description="Everyone who can be rostered, and the days they usually work."
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setForm(emptyForm());
              setDialogOpen(true);
            }}
          >
            <Plus />
            Add person
          </button>
        }
      />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Usual days</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr
                  key={person.id}
                  className="is-clickable"
                  onMouseEnter={() => preloadWorkspaceRoute(`/people/${person.id}`)}
                  onClick={() => openPerson(person.id)}
                >
                  <td className="font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        openPerson(person.id);
                      }}
                    >
                      {person.name}
                    </button>
                    {weeksDiffer(person) && <span className="badge ml-2">Fortnightly</span>}
                  </td>
                  <td>
                    <WorkingDays person={person} />
                  </td>
                  <td className="w-10 text-[var(--text-faint)]">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </td>
                </tr>
              ))}
              {people.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-[var(--text-muted)]">
                    No people yet. Add someone to start rostering.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--border)] px-5 py-3 text-[13px] text-[var(--text-muted)]">
          {people.length} {people.length === 1 ? "person" : "people"}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        title="Add person"
        description="You can set up a fortnightly pattern after adding them."
        as="form"
        onSubmit={handleSave}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
              {saving ? "Adding…" : "Add person"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="person-name">
              Name
            </label>
            <input
              id="person-name"
              className="input w-full"
              value={form.name}
              autoFocus
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div>
            <p className="field-label">Usual hours</p>
            <div className="divide-y divide-[var(--border)] rounded-[var(--radius-md)] border border-[var(--border)]">
              {ALL_DAYS.map((day) => {
                const schedule = form.schedule[day];
                return (
                  <div key={day} className="grid grid-cols-[1fr_auto] items-center gap-3 px-3 py-2 sm:grid-cols-[140px_1fr]">
                    <label className="flex items-center gap-2.5 text-[14px]">
                      <input
                        type="checkbox"
                        checked={schedule.enabled}
                        onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                      />
                      {DAY_LABELS[day]}
                    </label>
                    {schedule.enabled ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          className="input h-8 w-[118px] text-[13px]"
                          value={schedule.start}
                          onChange={(e) => updateDay(day, { start: e.target.value })}
                          aria-label={`${DAY_LABELS[day]} start time`}
                        />
                        <span className="text-[13px] text-[var(--text-muted)]">to</span>
                        <input
                          type="time"
                          className="input h-8 w-[118px] text-[13px]"
                          value={schedule.end}
                          onChange={(e) => updateDay(day, { end: e.target.value })}
                          aria-label={`${DAY_LABELS[day]} end time`}
                        />
                      </div>
                    ) : (
                      <span className="text-[13px] text-[var(--text-faint)]">Not working</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
