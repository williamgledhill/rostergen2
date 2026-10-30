"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import { isTourTemplate, type TaskTemplate } from "@/lib/taskTemplates";

/** Picks which task to put in an empty slot of the grid. */
export default function TaskPickerDialog({
  open,
  slotLabel,
  templates,
  onPick,
  onClose,
}: {
  open: boolean;
  slotLabel: string;
  templates: TaskTemplate[];
  onPick: (template: TaskTemplate) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name));
    return needle ? sorted.filter((template) => template.name.toLowerCase().includes(needle)) : sorted;
  }, [templates, query]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add task"
      description={slotLabel}
      as="form"
      onSubmit={(event) => {
        event.preventDefault();
        if (matches[0]) onPick(matches[0]);
      }}
    >
      {templates.length > 8 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-faint)]" />
          <input
            className="input w-full pl-9"
            placeholder="Filter tasks"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            aria-label="Filter tasks"
          />
        </div>
      )}
      {templates.length === 0 ? (
        <p className="text-[14px] text-[var(--text-muted)]">Loading tasks…</p>
      ) : matches.length === 0 ? (
        <p className="text-[14px] text-[var(--text-muted)]">No tasks match “{query}”.</p>
      ) : (
        <div className="space-y-4">
          {[
            { title: "Tours", items: matches.filter(isTourTemplate) },
            { title: "Tasks", items: matches.filter((template) => !isTourTemplate(template)) },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.04em] text-[var(--text-muted)]">
                  {group.title}
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {group.items.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => onPick(template)}
                      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2.5 text-left text-[14px] font-medium transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] focus-visible:border-[var(--accent)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-ring)]"
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-[5px] ring-1 ring-inset ring-black/10"
                        style={{ backgroundColor: template.color || "#fff" }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{template.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </Dialog>
  );
}
