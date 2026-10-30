import React from "react";
import { formatSavedAtLabel, type AutosaveState } from "@/lib/clientDrafts";

const STATES: Record<AutosaveState["state"], { dot: string; text: string }> = {
  idle: { dot: "bg-slate-300", text: "text-[var(--text-muted)]" },
  saved: { dot: "bg-emerald-500", text: "text-[var(--text-muted)]" },
  dirty: { dot: "bg-amber-400", text: "text-[var(--warning)]" },
  saving: { dot: "bg-amber-400 animate-pulse", text: "text-[var(--warning)]" },
  error: { dot: "bg-red-500", text: "text-[var(--danger)]" },
};

function describe(state: AutosaveState) {
  const savedAt = formatSavedAtLabel(state.savedAt);
  switch (state.state) {
    case "saving":
      return "Saving…";
    case "dirty":
      return "Unsaved changes";
    case "error":
      return "Couldn't save. Check your connection and press Save.";
    case "saved":
      return savedAt ? `Saved at ${savedAt}` : "All changes saved";
    default:
      return "Changes save automatically";
  }
}

/** Autosave status shown under page titles. */
export default function SaveStatus({ state }: { state: AutosaveState }) {
  const style = STATES[state.state];
  return (
    <span className={`inline-flex items-center gap-2 text-[12.5px] font-medium ${style.text}`} role="status">
      <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
      {describe(state)}
    </span>
  );
}
