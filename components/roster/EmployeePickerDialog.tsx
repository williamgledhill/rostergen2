"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import type { Person } from "@/lib/people";
import { isSameEmployee } from "@/lib/rosterGrid";
import type { RosterEmployee } from "@/lib/rosterTypes";

/** Adds saved people to the day's roster, or takes them off it. */
export default function EmployeePickerDialog({
  open,
  people,
  employees,
  onAdd,
  onRemove,
  onClose,
}: {
  open: boolean;
  people: Person[];
  employees: RosterEmployee[];
  onAdd: (person: Person) => void;
  onRemove: (person: Person) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filteredPeople = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? people.filter((person) => person.name.toLowerCase().includes(needle))
      : people;
    return [...matches].sort((a, b) => a.name.localeCompare(b.name));
  }, [people, query]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="People on this day"
      description="Tick someone to add them to the roster."
      footer={
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name"
          autoFocus
          className="input w-full pl-9"
          aria-label="Search people"
        />
      </div>

      {filteredPeople.length === 0 ? (
        <p className="py-4 text-center text-[14px] text-[var(--text-muted)]">
          {people.length === 0 ? "No saved people yet. Add them on the People page." : "No people match that search."}
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-md)] border border-[var(--border)]">
          {filteredPeople.map((person) => {
            const onRoster = employees.some((employee) => isSameEmployee(employee, person));
            return (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => (onRoster ? onRemove(person) : onAdd(person))}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--surface-subtle)] focus-visible:bg-[var(--surface-subtle)] focus-visible:outline-none"
                  aria-pressed={onRoster}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border ${
                      onRoster ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--border-strong)] bg-white"
                    }`}
                    aria-hidden="true"
                  >
                    {onRoster && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{person.name}</span>
                  {onRoster && <span className="badge badge-accent">On roster</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
