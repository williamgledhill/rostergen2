"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { UserMinus } from "lucide-react";
import { parseTimeToMinutes } from "@/lib/rosterTimeline";

/**
 * Changes one employee's hours for this day only. Valid changes apply as the
 * user types; "Use usual hours" goes back to their schedule.
 */
export default function EmployeeHoursPopover({
  employeeName,
  initialHours,
  onApply,
  onUseDefault,
  onRemove,
}: {
  employeeName: string;
  initialHours: { start: string; end: string };
  onApply: (hours: { start: string; end: string }) => void;
  onUseDefault: () => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(initialHours);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // Positioned against the viewport so the grid's scroll area can't clip it.
  useLayoutEffect(() => {
    const anchor = panelRef.current?.parentElement;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = panelRef.current?.offsetWidth ?? 272;
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
    setPosition({ top: rect.bottom + 6, left });
  }, []);

  function update(field: "start" | "end", value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    const startMin = parseTimeToMinutes(next.start);
    const endMin = parseTimeToMinutes(next.end);
    if (startMin === null || endMin === null || startMin >= endMin) {
      setError("The finish time must be after the start time.");
      return;
    }
    setError("");
    onApply(next);
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`Hours for ${employeeName}`}
      style={position ? { top: position.top, left: position.left } : { visibility: "hidden" }}
      className="dialog-enter fixed z-[60] w-[272px] rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4 text-left shadow-[var(--shadow-lg)]"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[14px] font-semibold">{employeeName}</p>
      <p className="text-[12.5px] text-[var(--text-muted)]">Hours for this day only</p>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="time"
          className="input time-input-no-icon h-8 min-w-0 flex-1 px-2 text-[13px]"
          value={draft.start}
          step={900}
          onChange={(e) => update("start", e.target.value)}
          aria-label="Start"
          autoFocus
        />
        <span className="text-[12px] text-[var(--text-muted)]">to</span>
        <input
          type="time"
          className="input time-input-no-icon h-8 min-w-0 flex-1 px-2 text-[13px]"
          value={draft.end}
          step={900}
          onChange={(e) => update("end", e.target.value)}
          aria-label="Finish"
        />
      </div>
      {error && <p className="mt-2 text-[12.5px] text-[var(--danger)]">{error}</p>}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
        <button type="button" className="btn btn-sm" onClick={onUseDefault}>
          Use usual hours
        </button>
        <button type="button" className="btn btn-ghost btn-sm !text-[var(--danger)]" onClick={onRemove}>
          <UserMinus />
          Remove
        </button>
      </div>
    </div>
  );
}
