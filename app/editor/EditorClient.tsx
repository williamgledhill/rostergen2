"use client";

import Grid, { DEFAULT_ROSTER_ZOOM, ROSTER_ZOOM_LEVELS, type GridHandle } from "@/components/Grid";
import TopBar, { type TopBarActions } from "@/components/TopBar";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Save, X } from "lucide-react";
import SaveStatus from "@/components/ui/SaveStatus";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AutosaveState, readDraftRecord } from "@/lib/clientDrafts";
import { formatFullDay, formatLocalId, parseLocalId } from "@/lib/dateUtils";
import { type Person } from "@/lib/people";
import type { AutofillNotice, GridTask, RosterEmployee } from "@/lib/rosterTypes";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settingsDefaults";
import { type TaskTemplate } from "@/lib/taskTemplates";
import { buildEditorDraftStorageKey, buildEditorHref, persistLastEditorDate } from "@/lib/editorPersistence";
import { navigateWithinSpa } from "@/lib/spaNavigation";

type EditorDraftValue = {
  hoursStart?: string;
  hoursEnd?: string;
};

const ROSTER_ZOOM_STORAGE_KEY = "rosterplanner:roster-zoom";

function resolveEditorHours(
  rosterDateId: string,
  initialRoster: { hoursStart?: string; hoursEnd?: string },
  defaultHoursForDay: { start: string; end: string }
) {
  const fallback = {
    start: initialRoster.hoursStart || defaultHoursForDay.start,
    end: initialRoster.hoursEnd || defaultHoursForDay.end,
  };

  const draft = readDraftRecord<EditorDraftValue>(buildEditorDraftStorageKey(rosterDateId));
  if (!draft?.value) return fallback;
  return {
    start: draft.value.hoursStart || fallback.start,
    end: draft.value.hoursEnd || fallback.end,
  };
}

export default function EditorClient({
  selectedDate,
  people,
  settings,
  templates,
  initialRoster,
}: {
  selectedDate: Date;
  people: Person[];
  settings: AppSettings;
  templates: TaskTemplate[];
  initialRoster: {
    employees: RosterEmployee[];
    tasks: GridTask[];
    hoursStart?: string;
    hoursEnd?: string;
    savedAt?: string;
  };
}) {
  const gridRef = useRef<GridHandle>(null);
  const [zoom, setZoom] = useState(DEFAULT_ROSTER_ZOOM);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(ROSTER_ZOOM_STORAGE_KEY));
      if (Number.isInteger(saved) && saved >= 0 && saved < ROSTER_ZOOM_LEVELS.length) setZoom(saved);
    } catch {
      // Storage unavailable; use the default zoom.
    }
  }, []);

  const changeZoom = (delta: number) => {
    setZoom((current) => {
      const next = Math.min(ROSTER_ZOOM_LEVELS.length - 1, Math.max(0, current + delta));
      try {
        window.localStorage.setItem(ROSTER_ZOOM_STORAGE_KEY, String(next));
      } catch {
        // Storage unavailable; the zoom still applies for this visit.
      }
      return next;
    });
  };
  const toolbarActions = useMemo<TopBarActions>(
    () => ({
      onAutofill: () => gridRef.current?.autofill(),
      onUndo: () => gridRef.current?.undo(),
      onRedo: () => gridRef.current?.redo(),
      onAddPerson: () => gridRef.current?.openEmployeePicker(),
      onReset: () => gridRef.current?.reset(),
      onImportSchoolTours: (file) => gridRef.current?.importSchoolTours(file),
    }),
    []
  );
  const rosterDateId = useMemo(() => formatLocalId(selectedDate), [selectedDate]);
  const dayLabel = useMemo(() => formatFullDay(selectedDate), [selectedDate]);
  const dayKey = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][selectedDate.getDay()];
  const defaultHoursForDay =
    settings.hoursByDay[dayKey as keyof typeof settings.hoursByDay] || DEFAULT_SETTINGS.hoursByDay.Mon;
  const initialSaveState = useMemo<AutosaveState>(
    () => (initialRoster.savedAt ? { state: "saved", savedAt: initialRoster.savedAt } : { state: "idle" }),
    [initialRoster.savedAt, rosterDateId]
  );

  const [hours, setHours] = useState<{ start: string; end: string }>(() =>
    resolveEditorHours(rosterDateId, initialRoster, defaultHoursForDay)
  );
  const [hoursTouched, setHoursTouched] = useState(false);
  const [saveState, setSaveState] = useState<AutosaveState>(initialSaveState);
  const [autofillNotice, setAutofillNotice] = useState<AutofillNotice | null>(null);

  useEffect(() => {
    setHoursTouched(false);
    setHours(resolveEditorHours(rosterDateId, initialRoster, defaultHoursForDay));
  }, [initialRoster.hoursStart, initialRoster.hoursEnd, defaultHoursForDay.start, defaultHoursForDay.end, rosterDateId]);

  useEffect(() => {
    if (hoursTouched) return;
    setHours(resolveEditorHours(rosterDateId, initialRoster, defaultHoursForDay));
  }, [initialRoster.hoursStart, initialRoster.hoursEnd, defaultHoursForDay.start, defaultHoursForDay.end, hoursTouched]);

  useEffect(() => {
    persistLastEditorDate(rosterDateId);
  }, [rosterDateId]);

  useEffect(() => {
    setSaveState(initialSaveState);
  }, [initialSaveState]);

  useEffect(() => {
    setAutofillNotice(null);
  }, [rosterDateId]);

  const handleRestoreDraftHours = useCallback((nextHours: { start: string; end: string }) => {
    setHoursTouched(true);
    setHours(nextHours);
  }, []);

  const goToDate = (date: Date) => {
    const href = buildEditorHref(formatLocalId(date));
    if (!navigateWithinSpa(href)) window.location.href = href;
  };
  const shiftDay = (offset: number) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + offset);
    goToDate(next);
  };
  const isToday = rosterDateId === formatLocalId(new Date());

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.015em]">{dayLabel}</h1>
          <div className="mt-2">
            <SaveStatus state={saveState} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center">
            <button type="button" className="btn btn-icon rounded-r-none" onClick={() => shiftDay(-1)} aria-label="Previous day">
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="btn -ml-px rounded-none"
              onClick={() => goToDate(new Date())}
              disabled={isToday}
            >
              Today
            </button>
            <button type="button" className="btn btn-icon -ml-px rounded-l-none" onClick={() => shiftDay(1)} aria-label="Next day">
              <ChevronRight />
            </button>
          </div>
          <input
            type="date"
            className="input"
            value={rosterDateId}
            onChange={(event) => {
              const date = parseLocalId(event.target.value);
              if (date) goToDate(date);
            }}
            aria-label="Go to date"
          />
          <button type="button" className="btn" onClick={() => gridRef.current?.exportWorkbook()}>
            <Download />
            Export
          </button>
          <button type="button" className="btn btn-primary" onClick={() => gridRef.current?.save()}>
            <Save />
            Save
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <TopBar
          actions={toolbarActions}
          hours={hours}
          zoom={{
            canZoomOut: zoom > 0,
            canZoomIn: zoom < ROSTER_ZOOM_LEVELS.length - 1,
            onZoomOut: () => changeZoom(-1),
            onZoomIn: () => changeZoom(1),
          }}
          onHoursStartChange={(value) => {
            setHoursTouched(true);
            setHours((prev) => ({ ...prev, start: value }));
          }}
          onHoursEndChange={(value) => {
            setHoursTouched(true);
            setHours((prev) => ({ ...prev, end: value }));
          }}
        />
        {autofillNotice && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-amber-200 bg-[var(--warning-soft)] px-4 py-3"
          >
            <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--warning)]" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-1 text-[13.5px] text-amber-950">
              <p className="font-medium">Autofill couldn&apos;t place everything</p>
              {autofillNotice.messages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon -mr-1 -mt-0.5"
              onClick={() => setAutofillNotice(null)}
              aria-label="Dismiss autofill notice"
            >
              <X />
            </button>
          </div>
        )}
        <Grid
          ref={gridRef}
          zoom={zoom}
          employees={initialRoster.employees}
          initialTasks={initialRoster.tasks}
          rosterDateId={rosterDateId}
          rosterDate={selectedDate}
          hoursStart={hours.start}
          hoursEnd={hours.end}
          initialSavedAt={initialRoster.savedAt}
          onSaveStateChange={setSaveState}
          onAutofillNoticeChange={setAutofillNotice}
          onRestoreDraftHours={handleRestoreDraftHours}
          people={people}
          templates={templates}
        />
      </div>
    </div>
  );
}
