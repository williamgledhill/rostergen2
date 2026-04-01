"use client";
import Grid from "@/components/Grid";
import TopBar from "@/components/TopBar";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { formatLocalId, formatFullDay } from "@/lib/dateUtils";
import { DEFAULT_SETTINGS } from "@/lib/settingsDefaults";
import { Person, getDayScheduleForDate } from "@/lib/people";

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

function EditorPageContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams?.get("date");
  const initialDate = useMemo(() => (dateParam ? new Date(`${dateParam}T00:00:00`) : undefined), [dateParam]);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate ?? new Date());
  const rosterDateId = formatLocalId(selectedDate);
  const dayLabel = useMemo(() => formatFullDay(selectedDate), [selectedDate]);
  const dayKey = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][selectedDate.getDay()];

  const [loaded, setLoaded] = useState<{ employees: any[]; tasks: any[]; hoursStart?: string; hoursEnd?: string } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [peopleReady, setPeopleReady] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hours, setHours] = useState<{ start: string; end: string }>(DEFAULT_SETTINGS.hoursByDay.Mon);
  const [hoursTouched, setHoursTouched] = useState(false);

  useEffect(() => {
    setSelectedDate(initialDate ?? new Date());
  }, [initialDate]);

  useEffect(() => {
    fetch("/api/people")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setPeople(Array.isArray(data) ? data : []);
        setPeopleReady(true);
      })
      .catch(() => {
        setPeople([]);
        setPeopleReady(true);
      });
  }, []);

  useEffect(() => {
    let active = true;
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (active) setSettings(data);
      } catch (err) {
        console.error(err);
      }
    }
    loadSettings();
    return () => {
      active = false;
    };
  }, []);

  function workingPeopleForDate(date: Date, list: Person[]) {
    return list
      .filter((p) => getDayScheduleForDate(p, date).enabled)
      .map((p) => ({ id: p.id, name: p.name }));
  }

  function syncEmployeesWithPeople(employees: any[], list: Person[]) {
    const byId = new Map(list.map((p) => [String(p.id), p.name]));
    const byName = new Map(list.map((p) => [p.name.toLowerCase(), p.name]));
    return employees.map((e) => {
      const idStr = String(e.id);
      const updatedName = byId.get(idStr) ?? byName.get(String(e.name || "").toLowerCase()) ?? e.name;
      return { ...e, name: updatedName };
    });
  }

  useEffect(() => {
    let active = true;
    async function load() {
      if (!rosterDateId) return;
      if (active) setLoaded(null);
      try {
        const res = await fetch(`/api/rosters?date=${rosterDateId}`);
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          const baseEmployees = Array.isArray(data?.employees) ? data.employees : [];
          const synced = syncEmployeesWithPeople(baseEmployees, people);
          setLoaded({
            employees: synced,
            tasks: Array.isArray(data?.tasks) ? data.tasks : [],
            hoursStart: typeof data?.hoursStart === "string" ? data.hoursStart : undefined,
            hoursEnd: typeof data?.hoursEnd === "string" ? data.hoursEnd : undefined,
          });
          return;
        }
      } catch (err) {
        console.error(err);
      }
      if (active && peopleReady) {
        const derivedEmployees = workingPeopleForDate(selectedDate, people);
        const synced = syncEmployeesWithPeople(derivedEmployees, people);
        setLoaded({ employees: synced, tasks: [] });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [rosterDateId, selectedDate, people, peopleReady]);

  const defaultHoursForDay = settings.hoursByDay[dayKey as keyof typeof settings.hoursByDay] || DEFAULT_SETTINGS.hoursByDay.Mon;

  useEffect(() => {
    setHoursTouched(false);
  }, [rosterDateId]);

  useEffect(() => {
    if (hoursTouched) return;
    const start = loaded?.hoursStart || defaultHoursForDay.start;
    const end = loaded?.hoursEnd || defaultHoursForDay.end;
    setHours({ start, end });
  }, [loaded?.hoursStart, loaded?.hoursEnd, defaultHoursForDay.start, defaultHoursForDay.end, hoursTouched]);

  const employees = loaded?.employees ?? null;
  const tasks = loaded?.tasks ?? [];

  return (
    <div className="w-full px-1 py-2 sm:px-2 sm:py-3 md:px-3 md:py-4">
      <div className="space-y-4 flex flex-col items-start">
        <div className="flex flex-col w-full gap-2">
          <div className="flex flex-col leading-tight">
            <h1 className="break-words text-[clamp(1.2rem,5vw,1.5rem)] font-semibold leading-tight">
              {dayLabel}
            </h1>
          </div>
        </div>

        <div className="sticky top-2 z-30 w-full md:top-3">
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

        {!employees ? (
          <div className="w-full rounded-lg border border-[var(--border)] bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
            Loading roster...
          </div>
        ) : (
          <Grid
            employees={employees}
            initialTasks={tasks}
            rosterDateId={rosterDateId}
            rosterDate={selectedDate}
            hoursStart={hours.start}
            hoursEnd={hours.end}
            onExportXLS={downloadXLS}
            people={people}
          />
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="w-full px-3 py-4 text-slate-700">Loading editor...</div>}>
      <EditorPageContent />
    </Suspense>
  );
}
