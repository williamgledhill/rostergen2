"use client";

import Grid from "@/components/Grid";
import TopBar from "@/components/TopBar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AutosaveState, formatAutosaveStatusText, getAutosaveStatusClassName, readDraftRecord } from "@/lib/clientDrafts";
import { formatFullDay, formatLocalId } from "@/lib/dateUtils";
import { type Person } from "@/lib/people";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settingsDefaults";
import { type TaskTemplate } from "@/lib/taskTemplates";
import { buildEditorDraftStorageKey, persistLastEditorDate } from "@/lib/editorPersistence";

function sanitizeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*]/g, "").trim() || "roster";
}

function downloadXLS(html: string, fileName: string) {
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeFileName(fileName)}.xls`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

type EditorDraftValue = {
  hoursStart?: string;
  hoursEnd?: string;
};

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
  initialRoster: { employees: any[]; tasks: any[]; hoursStart?: string; hoursEnd?: string; savedAt?: string };
}) {
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

  const saveStatusText = useMemo(() => formatAutosaveStatusText(saveState), [saveState]);
  const saveStatusClassName = useMemo(() => getAutosaveStatusClassName(saveState), [saveState]);
  const handleRestoreDraftHours = useCallback((nextHours: { start: string; end: string }) => {
    setHoursTouched(true);
    setHours(nextHours);
  }, []);

  return (
    <div className="w-full overflow-x-hidden px-3 py-3">
      <div className="space-y-4 flex flex-col items-start">
        <div className="flex flex-col w-full gap-2">
          <div className="flex flex-col leading-tight">
            <h1 className="break-words text-[clamp(1.2rem,5vw,1.5rem)] font-semibold leading-tight">{dayLabel}</h1>
            <p className="mt-1 text-[14px] text-slate-600">Edit coverage, adjust hours, and export this day&apos;s roster.</p>
            <p className={`mt-1 text-[12px] font-medium ${saveStatusClassName}`}>{saveStatusText}</p>
          </div>
        </div>

        <Grid
          toolbar={
            <TopBar
              merged
              hours={hours}
              onHoursStartChange={(value) => {
                setHoursTouched(true);
                setHours((prev) => ({ ...prev, start: value }));
              }}
              onHoursEndChange={(value) => {
                setHoursTouched(true);
                setHours((prev) => ({ ...prev, end: value }));
              }}
              onHoursDefault={() => {
                setHoursTouched(false);
                setHours({ start: defaultHoursForDay.start, end: defaultHoursForDay.end });
              }}
            />
          }
          employees={initialRoster.employees}
          initialTasks={initialRoster.tasks}
          rosterDateId={rosterDateId}
          rosterDate={selectedDate}
          hoursStart={hours.start}
          hoursEnd={hours.end}
          initialSavedAt={initialRoster.savedAt}
          onExportXLS={downloadXLS}
          onSaveStateChange={setSaveState}
          onRestoreDraftHours={handleRestoreDraftHours}
          people={people}
          templates={templates}
        />
      </div>
    </div>
  );
}
