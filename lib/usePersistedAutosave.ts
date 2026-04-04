"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutosaveMode, AutosaveState, PersistedDraftRecord, readDraftRecord, writeDraftRecord } from "@/lib/clientDrafts";

type SaveResult<T> = {
  value?: T;
  savedAt?: string;
};

type SaveHandler<T> = (
  value: T,
  options: { mode: AutosaveMode; keepalive?: boolean }
) => Promise<SaveResult<T> | void>;

export function usePersistedAutosave<T>(options: {
  storageKey: string;
  initialValue: T;
  initialSavedAt?: string;
  autosaveDelayMs?: number;
  canSave?: boolean;
  canSaveValue?: (value: T) => boolean;
  getSignature: (value: T) => string;
  save: SaveHandler<T>;
}) {
  const {
    storageKey,
    initialValue,
    initialSavedAt,
    autosaveDelayMs = 700,
    canSave = true,
    canSaveValue,
    getSignature,
    save,
  } = options;

  const initialSignature = useMemo(() => getSignature(initialValue), [getSignature, initialValue]);
  const [value, setValue] = useState<T>(initialValue);
  const [saveState, setSaveState] = useState<AutosaveState>(
    initialSavedAt ? { state: "saved", savedAt: initialSavedAt } : { state: "idle" }
  );

  const valueRef = useRef(value);
  const saveStateRef = useRef(saveState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInFlightRef = useRef(false);
  const queuedModeRef = useRef<AutosaveMode | null>(null);
  const lastSavedSignatureRef = useRef(initialSignature);
  const saveCycleRef = useRef(0);

  const clearAutosaveTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const persistDraft = useCallback(
    (nextValue: T, lastSavedSignature: string, savedAt?: string) => {
      writeDraftRecord<T>(storageKey, {
        value: nextValue,
        lastSavedSignature,
        savedAt,
      });
    },
    [storageKey]
  );

  const saveNow = useCallback(
    async (saveOptions?: { mode?: AutosaveMode; keepalive?: boolean }) => {
      const mode = saveOptions?.mode ?? "manual";
      clearAutosaveTimer();

      const snapshot = valueRef.current;
      if (!canSave || (typeof canSaveValue === "function" && !canSaveValue(snapshot))) return;
      const nextSignature = getSignature(snapshot);
      if (nextSignature === lastSavedSignatureRef.current) return;

      if (saveInFlightRef.current) {
        queuedModeRef.current = mode;
        return;
      }

      saveInFlightRef.current = true;
      const saveCycle = saveCycleRef.current;
      const previousSavedAt = saveStateRef.current.savedAt;
      const nextSavingState: AutosaveState = { state: "saving", mode, savedAt: previousSavedAt };
      saveStateRef.current = nextSavingState;
      setSaveState(nextSavingState);

      try {
        const result = (await save(snapshot, { mode, keepalive: saveOptions?.keepalive })) || {};
        const savedValue = result.value ?? snapshot;
        const savedAt = result.savedAt ?? new Date().toISOString();
        const savedSignature = getSignature(savedValue);

        if (saveCycle === saveCycleRef.current) {
          valueRef.current = savedValue;
          lastSavedSignatureRef.current = savedSignature;
          persistDraft(savedValue, savedSignature, savedAt);
          if (result.value !== undefined) {
            setValue(savedValue);
          }
          const nextSavedState: AutosaveState = { state: "saved", mode, savedAt };
          saveStateRef.current = nextSavedState;
          setSaveState(nextSavedState);
        }
      } catch (error) {
        console.error(error);
        if (saveCycle === saveCycleRef.current) {
          const nextErrorState: AutosaveState = {
            state: "error",
            mode,
            savedAt: saveStateRef.current.savedAt,
          };
          saveStateRef.current = nextErrorState;
          setSaveState(nextErrorState);
          persistDraft(snapshot, lastSavedSignatureRef.current, saveStateRef.current.savedAt);
        }
      } finally {
        saveInFlightRef.current = false;
        if (queuedModeRef.current) {
          const queuedMode = queuedModeRef.current;
          queuedModeRef.current = null;
          void saveNow({ mode: queuedMode });
        }
      }
    },
    [canSave, canSaveValue, clearAutosaveTimer, getSignature, persistDraft, save]
  );

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    clearAutosaveTimer();
    saveCycleRef.current += 1;
    queuedModeRef.current = null;

    const draft = readDraftRecord<T>(storageKey);
    const nextValue = draft?.value ?? initialValue;
    const nextSignature = getSignature(nextValue);
    const nextSavedSignature = draft?.lastSavedSignature ?? initialSignature;
    const nextSavedAt = draft?.savedAt ?? initialSavedAt;
    const shouldUseDraft =
      draft !== null &&
      (nextSignature !== initialSignature || nextSavedSignature !== initialSignature);

    valueRef.current = shouldUseDraft ? nextValue : initialValue;
    lastSavedSignatureRef.current = shouldUseDraft ? nextSavedSignature : initialSignature;
    persistDraft(valueRef.current, lastSavedSignatureRef.current, nextSavedAt);
    setValue(valueRef.current);

    const nextState: AutosaveState =
      nextSignature !== lastSavedSignatureRef.current
        ? { state: "dirty", mode: "autosave", savedAt: nextSavedAt }
        : nextSavedAt
          ? { state: "saved", savedAt: nextSavedAt }
          : { state: "idle" };
    saveStateRef.current = nextState;
    setSaveState(nextState);
  }, [clearAutosaveTimer, getSignature, initialSavedAt, initialSignature, initialValue, persistDraft, storageKey]);

  const currentSignature = useMemo(() => getSignature(value), [getSignature, value]);

  useEffect(() => {
    persistDraft(value, lastSavedSignatureRef.current, saveStateRef.current.savedAt);
    if (currentSignature === lastSavedSignatureRef.current) return;

    const nextDirtyState: AutosaveState = {
      state: "dirty",
      mode: "autosave",
      savedAt: saveStateRef.current.savedAt,
    };
    saveStateRef.current = nextDirtyState;
    setSaveState(nextDirtyState);
    if (!canSave || (typeof canSaveValue === "function" && !canSaveValue(value))) {
      clearAutosaveTimer();
      return;
    }
    clearAutosaveTimer();
    timerRef.current = setTimeout(() => {
      void saveNow({ mode: "autosave" });
    }, autosaveDelayMs);

    return clearAutosaveTimer;
  }, [autosaveDelayMs, canSave, canSaveValue, clearAutosaveTimer, currentSignature, persistDraft, saveNow, value]);

  useEffect(() => {
    const flushAutosave = () => {
      const signature = getSignature(valueRef.current);
      if (signature === lastSavedSignatureRef.current) return;
      clearAutosaveTimer();
      void saveNow({ mode: "autosave", keepalive: true });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushAutosave();
    };

    window.addEventListener("pagehide", flushAutosave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", flushAutosave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [clearAutosaveTimer, getSignature, saveNow]);

  return {
    value,
    setValue: setValue as Dispatch<SetStateAction<T>>,
    saveState,
    saveNow,
  };
}
