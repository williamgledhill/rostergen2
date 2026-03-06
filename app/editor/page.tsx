"use client";
import Grid from "@/components/Grid";
import TopBar from "@/components/TopBar";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import { formatLocalId, formatFullDay } from "@/lib/dateUtils";
import { DEFAULT_SETTINGS } from "@/lib/settingsDefaults";
import { Person } from "@/lib/people";
import { ChevronRight } from "lucide-react";

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

export default function Page() {
  const searchParams = useSearchParams();
  const dateParam = searchParams?.get("date");
  const initialDate = useMemo(() => (dateParam ? new Date(`${dateParam}T00:00:00`) : undefined), [dateParam]);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate ?? new Date());
  const rosterDateId = formatLocalId(selectedDate);
  const monthId = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(selectedDate);
  const dayLabel = useMemo(() => formatFullDay(selectedDate), [selectedDate]);
  const dayKey = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][selectedDate.getDay()];

  const fallbackEmployees = [
    { id: 1, name: "John" },
    { id: 2, name: "Robert" },
    { id: 3, name: "Mary" },
  ];
  const fallbackTasks: any[] = [];

  const [loaded, setLoaded] = useState<{ employees: any[]; tasks: any[]; hoursStart?: string; hoursEnd?: string } | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hours, setHours] = useState<{ start: string; end: string }>(DEFAULT_SETTINGS.hoursByDay.Mon);
  const [hoursTouched, setHoursTouched] = useState(false);

  useEffect(() => {
    fetch("/api/people")
      .then((res) => (res.ok ? res.json() : []))
      .then(setPeople)
      .catch(() => setPeople([]));
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
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
    return list
      .filter((p) => p.schedule?.[dow]?.enabled)
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
      try {
        const res = await fetch(`/api/rosters?date=${rosterDateId}`);
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          const baseEmployees = Array.isArray(data?.employees) ? data.employees : [];
          const derivedEmployees = baseEmployees.length
            ? baseEmployees
            : workingPeopleForDate(selectedDate, people);
          const synced = syncEmployeesWithPeople(derivedEmployees.length ? derivedEmployees : fallbackEmployees, people);
          setLoaded({
            employees: synced,
            tasks: Array.isArray(data?.tasks) ? data.tasks : fallbackTasks,
            hoursStart: typeof data?.hoursStart === "string" ? data.hoursStart : undefined,
            hoursEnd: typeof data?.hoursEnd === "string" ? data.hoursEnd : undefined,
          });
          return;
        }
      } catch (err) {
        console.error(err);
      }
      if (active) {
        const derivedEmployees = workingPeopleForDate(selectedDate, people);
        const synced = syncEmployeesWithPeople(derivedEmployees.length ? derivedEmployees : fallbackEmployees, people);
        setLoaded({ employees: synced, tasks: fallbackTasks });
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [rosterDateId, selectedDate, people]);

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

  const employees = loaded?.employees ?? fallbackEmployees;
  const tasks = loaded?.tasks ?? fallbackTasks;

  return (
    <div className="w-full py-4 px-3">
      <div className="space-y-4 flex flex-col items-start">
        <div className="flex items-center gap-2">
          <Link
            href="/rosters"
            className="inline-flex items-center gap-1 text-[#675dff] font-semibold text-[14px]"
          >
            <span className="hover:underline">Rosters</span>
            <ChevronRight className="w-4 h-4 text-slate-700" />
          </Link>
          <Link
            href={`/rosters/months/${monthId}`}
            className="inline-flex items-center gap-1 text-[#675dff] font-semibold text-[14px]"
          >
            <span className="hover:underline">{monthLabel}</span>
          </Link>
        </div>

        <div className="flex flex-col w-full gap-2">
          <div className="flex flex-col leading-tight">
            <h1 className="text-2xl font-semibold">{dayLabel}</h1>
            <p className="text-slate-600 text-[14px]">Roster editor</p>
          </div>
          <TopBar />
        </div>

        <div className="flex items-center w-full flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-slate-700">Hours</span>
            <input
              type="time"
              className="input w-[140px] text-[14px]"
              value={hours.start}
              step={900}
              onChange={(e) => {
                setHoursTouched(true);
                setHours((prev) => ({ ...prev, start: e.target.value }));
              }}
            />
            <span className="text-slate-500 text-[13px]">to</span>
            <input
              type="time"
              className="input w-[140px] text-[14px]"
              value={hours.end}
              step={900}
              onChange={(e) => {
                setHoursTouched(true);
                setHours((prev) => ({ ...prev, end: e.target.value }));
              }}
            />
            <button
              className="btn h-8 px-3"
              type="button"
              onClick={() => {
                setHoursTouched(false);
                setHours({ start: defaultHoursForDay.start, end: defaultHoursForDay.end });
              }}
            >
              Default
            </button>
          </div>
        </div>

        <Grid
          employees={employees}
          initialTasks={tasks}
          rosterDateId={rosterDateId}
          rosterDate={selectedDate}
          hoursStart={hours.start}
          hoursEnd={hours.end}
          onExportXLS={downloadXLS}
        />
      </div>
    </div>
  );
}
