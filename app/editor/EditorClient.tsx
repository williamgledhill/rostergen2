"use client";

import Grid from "@/components/Grid";
import TopBar from "@/components/TopBar";
import { X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AutosaveState, formatAutosaveStatusText, getAutosaveStatusClassName, readDraftRecord } from "@/lib/clientDrafts";
import { formatFullDay, formatLocalId } from "@/lib/dateUtils";
import { type Person } from "@/lib/people";
import { buildWorkbookFromHtmlTable, sanitizeExportFileName } from "@/lib/rosterExport";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settingsDefaults";
import { type TaskTemplate } from "@/lib/taskTemplates";
import { buildEditorDraftStorageKey, persistLastEditorDate } from "@/lib/editorPersistence";
import { type AutofillNotice } from "@/components/Grid";

function downloadWorkbook(html: string, fileName: string) {
  const workbook = buildWorkbookFromHtmlTable(html, fileName);
  const blob = new Blob([workbook], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeExportFileName(fileName)}.xlsx`;
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

  const saveStatusText = useMemo(() => formatAutosaveStatusText(saveState), [saveState]);
  const saveStatusClassName = useMemo(() => getAutosaveStatusClassName(saveState), [saveState]);
  const handleRestoreDraftHours = useCallback((nextHours: { start: string; end: string }) => {
    setHoursTouched(true);
    setHours(nextHours);
  }, []);

  return (
    <div className="w-full overflow-x-hidden px-3 py-3">
      <div className="flex w-full flex-col gap-3">
        <div className="flex flex-col leading-tight">
          <h1 className="break-words text-[clamp(1.2rem,5vw,1.5rem)] font-semibold leading-tight">{dayLabel}</h1>
          <p className="mt-1 text-[14px] text-slate-600">Edit coverage, adjust hours, and export this day&apos;s roster.</p>
          <p className={`mt-1 text-[12px] font-medium ${saveStatusClassName}`}>{saveStatusText}</p>
        </div>
        <TopBar
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
        <Grid
          employees={initialRoster.employees}
          initialTasks={initialRoster.tasks}
          rosterDateId={rosterDateId}
          rosterDate={selectedDate}
          hoursStart={hours.start}
          hoursEnd={hours.end}
          initialSavedAt={initialRoster.savedAt}
          onExportWorkbook={downloadWorkbook}
          onSaveStateChange={setSaveState}
          onAutofillNoticeChange={setAutofillNotice}
          onRestoreDraftHours={handleRestoreDraftHours}
          people={people}
          templates={templates}
        />
      </div>
      {autofillNotice && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
          <div className="pointer-events-auto w-full max-w-[720px] rounded-[12px] border border-amber-200 bg-white/95 px-4 py-3 shadow-[0_14px_32px_rgba(15,23,42,0.14)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900">{autofillNotice.title}</p>
                <div className="mt-1 space-y-1">
                  {autofillNotice.messages.map((message) => (
                    <p key={message} className="text-[13px] leading-5 text-slate-700">
                      {message}
                    </p>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                onClick={() => setAutofillNotice(null)}
                aria-label="Dismiss autofill notice"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
