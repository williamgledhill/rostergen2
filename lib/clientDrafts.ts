export type AutosaveMode = "autosave" | "manual";

export type AutosaveState = {
  state: "idle" | "dirty" | "saving" | "saved" | "error";
  mode?: AutosaveMode;
  savedAt?: string;
};

export type PersistedDraftRecord<T> = {
  value: T;
  lastSavedSignature: string;
  savedAt?: string;
};

export function buildDraftStorageKey(scope: string, id: string) {
  return `rosterplanner:draft:${scope}:${id}`;
}

export function readDraftRecord<T>(storageKey: string): PersistedDraftRecord<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedDraftRecord<T>;
  } catch {
    return null;
  }
}

export function writeDraftRecord<T>(storageKey: string, record: PersistedDraftRecord<T>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(record));
  } catch {
    // Ignore storage quota and serialization failures in the UI.
  }
}

export function removeDraftRecord(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures.
  }
}

export function formatSavedAtLabel(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export function formatAutosaveStatusText(
  saveState: AutosaveState,
  options?: { idleText?: string }
) {
  const savedAt = formatSavedAtLabel(saveState.savedAt);
  if (saveState.state === "saving") {
    return saveState.mode === "manual" ? "Saving now..." : "Autosaving changes...";
  }
  if (saveState.state === "dirty") {
    return "Unsaved changes. Autosave will run shortly.";
  }
  if (saveState.state === "error") {
    return "Autosave failed. Keep this tab open and try Save again.";
  }
  if (saveState.state === "saved" && savedAt) {
    return saveState.mode === "manual" ? `Last saved at ${savedAt}.` : `Last autosaved at ${savedAt}.`;
  }
  return options?.idleText || "Autosaves after every edit.";
}

export function getAutosaveStatusClassName(saveState: AutosaveState) {
  if (saveState.state === "error") return "text-red-600";
  if (saveState.state === "saving" || saveState.state === "dirty") return "text-amber-700";
  return "text-slate-500";
}
