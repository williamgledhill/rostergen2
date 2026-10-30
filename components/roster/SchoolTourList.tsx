"use client";

import React from "react";
import { X } from "lucide-react";
import { schoolTourLabel, sortSchoolTours } from "@/lib/rosterGrid";
import { formatShortTime } from "@/lib/rosterTimeline";
import type { SchoolTourEntry } from "@/lib/rosterTypes";

/** Numbered key under the roster: "School Tour 1" on the grid is the first school listed here. */
export default function SchoolTourList({
  tours,
  onRemove,
  onClear,
}: {
  tours: SchoolTourEntry[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (tours.length === 0) return null;

  return (
    <div className="px-1 text-[12px] leading-5 text-[var(--text-muted)]">
      <div className="flex items-center gap-3">
        <span className="font-semibold uppercase tracking-[0.04em] text-[var(--text)]">School tours</span>
        <button type="button" className="font-medium text-[var(--danger)] hover:underline" onClick={onClear}>
          Clear all
        </button>
      </div>
      <ol className="mt-0.5 flex flex-wrap gap-x-5">
        {sortSchoolTours([...tours]).map((tour, index) => (
          <li key={tour.id} className="group inline-flex items-center gap-1">
            <span className="font-medium text-[var(--text)]">{schoolTourLabel(index)}:</span>
            <span className="tabular-nums">{formatShortTime(tour.startTime)}</span>
            <span>{tour.schoolName}</span>
            <span>({tour.studentCount} students)</span>
            <button
              type="button"
              className="ml-0.5 rounded p-0.5 opacity-40 hover:bg-[var(--surface-muted)] hover:opacity-100 focus-visible:opacity-100"
              onClick={() => onRemove(tour.id)}
              aria-label={`Remove ${tour.schoolName}`}
            >
              <X className="h-3 w-3" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
