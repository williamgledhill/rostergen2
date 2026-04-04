import { buildDraftStorageKey } from "@/lib/clientDrafts";

export const LAST_EDITOR_DATE_COOKIE = "last-editor-date";
export const LAST_EDITOR_DATE_STORAGE_KEY = "rosterplanner:last-editor-date";
export const LAST_EDITOR_DATE_EVENT = "editor:last-date-changed";

export function isLocalDateId(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function buildEditorHref(dateId?: string | null) {
  return isLocalDateId(dateId) ? `/editor?date=${encodeURIComponent(dateId)}` : "/editor";
}

export function buildEditorDraftStorageKey(dateId: string) {
  return buildDraftStorageKey("editor", dateId);
}

export function persistLastEditorDate(dateId: string) {
  if (typeof window === "undefined" || !isLocalDateId(dateId)) return;

  window.localStorage.setItem(LAST_EDITOR_DATE_STORAGE_KEY, dateId);
  document.cookie = `${LAST_EDITOR_DATE_COOKIE}=${dateId}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(
    new CustomEvent(LAST_EDITOR_DATE_EVENT, {
      detail: { dateId },
    })
  );
}
