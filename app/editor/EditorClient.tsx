"use client";

import Grid from "@/components/Grid";
import TopBar from "@/components/TopBar";
import React, { useEffect, useMemo, useState } from "react";
import { formatFullDay, formatLocalId } from "@/lib/dateUtils";
import { type Person } from "@/lib/people";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settingsDefaults";
import { type TaskTemplate } from "@/lib/taskTemplates";

function downloadXLS(html: string) {
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roster.xls";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
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
  initialRoster: { employees: any[]; tasks: any[]; hoursStart?: string; hoursEnd?: string };
}) {
  const rosterDateId = useMemo(() => formatLocalId(selectedDate), [selectedDate]);
  const dayLabel = useMemo(() => formatFullDay(selectedDate), [selectedDate]);
  const dayKey = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][selectedDate.getDay()];
  const defaultHoursForDay =
    settings.hoursByDay[dayKey as keyof typeof settings.hoursByDay] || DEFAULT_SETTINGS.hoursByDay.Mon;

  const [hours, setHours] = useState<{ start: string; end: string }>({
    start: initialRoster.hoursStart || defaultHoursForDay.start,
    end: initialRoster.hoursEnd || defaultHoursForDay.end,
  });
  const [hoursTouched, setHoursTouched] = useState(false);

  useEffect(() => {
    setHoursTouched(false);
    setHours({
      start: initialRoster.hoursStart || defaultHoursForDay.start,
      end: initialRoster.hoursEnd || defaultHoursForDay.end,
    });
  }, [initialRoster.hoursStart, initialRoster.hoursEnd, defaultHoursForDay.start, defaultHoursForDay.end, rosterDateId]);

  useEffect(() => {
    if (hoursTouched) return;
    setHours({
      start: initialRoster.hoursStart || defaultHoursForDay.start,
      end: initialRoster.hoursEnd || defaultHoursForDay.end,
    });
  }, [initialRoster.hoursStart, initialRoster.hoursEnd, defaultHoursForDay.start, defaultHoursForDay.end, hoursTouched]);

  return (
    <div className="w-full overflow-x-hidden px-1 py-2 sm:px-2 sm:py-3 md:px-3 md:py-4">
      <div className="space-y-4 flex flex-col items-start">
        <div className="flex flex-col w-full gap-2">
          <div className="flex flex-col leading-tight">
            <h1 className="break-words text-[clamp(1.2rem,5vw,1.5rem)] font-semibold leading-tight">{dayLabel}</h1>
          </div>
        </div>

        <div className="sticky top-2 z-30 w-full max-w-full overflow-hidden md:top-3">
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
        </div>

        <Grid
          employees={initialRoster.employees}
          initialTasks={initialRoster.tasks}
          rosterDateId={rosterDateId}
          rosterDate={selectedDate}
          hoursStart={hours.start}
          hoursEnd={hours.end}
          onExportXLS={downloadXLS}
          people={people}
          templates={templates}
        />
      </div>
    </div>
  );
}
