"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Copy, Save, Trash2 } from "lucide-react";
import { useFeedback } from "@/components/ui/Feedback";
import PageHeader from "@/components/ui/PageHeader";
import SaveStatus from "@/components/ui/SaveStatus";
import SpaLink from "@/components/ui/SpaLink";
import { buildDraftStorageKey, removeDraftRecord } from "@/lib/clientDrafts";
import {
  ALL_DAYS,
  ensureFortnightSchedule,
  getFortnightWeekKey,
  type DayKey,
  type DaySchedule,
  type FortnightSchedule,
  type Person,
} from "@/lib/people";
import { DAY_LABELS } from "@/lib/settingsDefaults";
import { navigateWithinSpa } from "@/lib/spaNavigation";
import { usePersistedAutosave } from "@/lib/usePersistedAutosave";
import { deleteCachedPerson, upsertCachedPerson } from "@/lib/workspaceData";

type PersonEditor = Omit<Person, "fortnight"> & { fortnight: FortnightSchedule };
type WeekKey = "weekA" | "weekB";

const WEEKS: Array<{ key: WeekKey; label: string }> = [
  { key: "weekA", label: "Week A" },
  { key: "weekB", label: "Week B" },
];

function cloneWeek(week: Record<DayKey, DaySchedule>) {
  return Object.fromEntries(ALL_DAYS.map((day) => [day, { ...week[day] }])) as Record<DayKey, DaySchedule>;
}

function toEditorPerson(raw: Person): PersonEditor {
  const fortnight = ensureFortnightSchedule(raw);
  return { ...raw, schedule: cloneWeek(fortnight.weekA), fortnight };
}

function DayCell({
  schedule,
  weekLabel,
  label,
  onChange,
}: {
  schedule: DaySchedule;
  weekLabel: string;
  label: string;
  onChange: (patch: Partial<DaySchedule>) => void;
}) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-2">
      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={schedule.enabled}
          onChange={() => onChange({ enabled: !schedule.enabled })}
          aria-label={`${label} working`}
        />
        <span className="w-14 font-medium sm:hidden">{weekLabel}</span>
        {!schedule.enabled && <span className="text-[var(--text-faint)]">Off</span>}
      </label>
      {schedule.enabled && (
        <div className="flex items-center gap-1.5">
          <input
            type="time"
            className="input time-input-no-icon h-8 w-[92px] px-2 text-[13px]"
            value={schedule.start}
            onChange={(event) => onChange({ start: event.target.value })}
            aria-label={`${label} start`}
          />
          <span className="text-[12px] text-[var(--text-muted)]">to</span>
          <input
            type="time"
            className="input time-input-no-icon h-8 w-[92px] px-2 text-[13px]"
            value={schedule.end}
            onChange={(event) => onChange({ end: event.target.value })}
            aria-label={`${label} end`}
          />
        </div>
      )}
    </div>
  );
}

export default function PersonDetailClient({ id, initialPerson }: { id: string; initialPerson: Person | null }) {
  const router = useRouter();
  const { confirm, notify } = useFeedback();
  const initialEditorPerson = useMemo(() => (initialPerson ? toEditorPerson(initialPerson) : null), [initialPerson]);
  const { value: person, setValue: setPerson, saveState, saveNow } = usePersistedAutosave<PersonEditor | null>({
    storageKey: buildDraftStorageKey("person", id),
    initialValue: initialEditorPerson,
    getSignature: (value) => JSON.stringify(value),
    // An empty name can't be saved; wait until one is typed.
    canSaveValue: (value) => !!value?.name.trim(),
    save: async (value, { keepalive }) => {
      if (!value) return;
      const payload: Person = {
        ...value,
        name: value.name.trim(),
        schedule: cloneWeek(value.fortnight.weekA),
        fortnight: value.fortnight,
      };
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive,
      });
      if (!res.ok) throw new Error("Save failed");
      const saved = (await res.json()) as Person;
      upsertCachedPerson(saved);
      return { value: toEditorPerson(saved), savedAt: new Date().toISOString() };
    },
  });

  const goToPeople = () => {
    if (!navigateWithinSpa("/people")) router.push("/people");
  };

  function update(patch: Partial<PersonEditor>) {
    setPerson((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function updateDay(week: WeekKey, day: DayKey, patch: Partial<DaySchedule>) {
    setPerson((prev) => {
      if (!prev) return prev;
      const weekSchedule = prev.fortnight[week];
      return {
        ...prev,
        fortnight: { ...prev.fortnight, [week]: { ...weekSchedule, [day]: { ...weekSchedule[day], ...patch } } },
      };
    });
  }

  function copyWeek(from: WeekKey, to: WeekKey) {
    setPerson((prev) => (prev ? { ...prev, fortnight: { ...prev.fortnight, [to]: cloneWeek(prev.fortnight[from]) } } : prev));
    notify({ tone: "success", title: `${from === "weekA" ? "Week A" : "Week B"} copied to ${to === "weekA" ? "Week A" : "Week B"}` });
  }

  async function removePerson() {
    const confirmed = await confirm({
      title: `Delete ${person?.name || "this person"}?`,
      message: "They'll be removed from People. Rosters already saved keep their name.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/people?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      removeDraftRecord(buildDraftStorageKey("person", id));
      deleteCachedPerson(id);
      notify({ tone: "success", title: `${person?.name ?? "Person"} deleted` });
      goToPeople();
    } catch {
      notify({ tone: "error", title: "Couldn't delete this person", message: "Please try again." });
    }
  }

  if (!person) {
    return (
      <div className="card max-w-xl p-6">
        <h1 className="text-[18px] font-semibold">Person not found</h1>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">They may have been deleted.</p>
        <SpaLink href="/people" className="btn mt-4">
          Back to people
        </SpaLink>
      </div>
    );
  }

  const currentWeek = getFortnightWeekKey(new Date(), person.fortnight.anchorDate) === "weekA" ? "Week A" : "Week B";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        breadcrumb={{ label: "People", href: "/people" }}
        title={person.name.trim() || "Unnamed person"}
        meta={<SaveStatus state={saveState} />}
        actions={
          <>
            <button type="button" className="btn btn-danger" onClick={removePerson}>
              <Trash2 />
              Delete
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveNow({ mode: "manual" })}
              disabled={saveState.state === "saving" || !person.name.trim()}
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
          <div className="p-5">
            <label className="field-label" htmlFor="person-name">
              Name
            </label>
            <input
              id="person-name"
              className="input w-full max-w-md"
              value={person.name}
              onChange={(event) => update({ name: event.target.value })}
            />
            {!person.name.trim() && <p className="field-hint !text-[var(--danger)]">Enter a name to save changes.</p>}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Working pattern</h2>
              <p className="card-description">
                Weeks A and B alternate. Make them the same for a weekly pattern. This week is{" "}
                <span className="font-medium text-[var(--text)]">{currentWeek}</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[13px] text-[var(--text-muted)]" htmlFor="cycle-start">
                Week A starts
              </label>
              <input
                id="cycle-start"
                type="date"
                className="input h-8 w-[150px] text-[13px]"
                value={person.fortnight.anchorDate}
                onChange={(event) => update({ fortnight: { ...person.fortnight, anchorDate: event.target.value } })}
              />
              <button type="button" className="btn btn-sm" onClick={() => copyWeek("weekA", "weekB")}>
                <Copy />A to B
              </button>
              <button type="button" className="btn btn-sm" onClick={() => copyWeek("weekB", "weekA")}>
                <Copy />B to A
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead className="hidden sm:table-header-group">
                <tr>
                  <th className="w-[140px]">Day</th>
                  {WEEKS.map((week) => (
                    <th key={week.key}>{week.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_DAYS.map((day) => (
                  <tr key={day} className="flex flex-col gap-2 py-3 sm:table-row sm:py-0">
                    <td className="!border-b-0 !py-0 font-medium sm:!border-b sm:!py-3">{DAY_LABELS[day]}</td>
                    {WEEKS.map((week) => (
                      <td key={week.key} className="!border-b-0 !py-0 sm:!border-b sm:!py-2.5">
                        <DayCell
                          weekLabel={week.label}
                          label={`${week.label} ${DAY_LABELS[day]}`}
                          schedule={person.fortnight[week.key][day]}
                          onChange={(patch) => updateDay(week.key, day, patch)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
