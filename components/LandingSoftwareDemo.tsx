"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  FolderOpen,
  Pencil,
  Settings,
  Users,
} from "lucide-react";
import TopBar from "@/components/TopBar";
import Grid from "@/components/Grid";
import { formatFullDay } from "@/lib/dateUtils";

const demoDate = new Date("2026-03-30T00:00:00");

const demoEmployees = [
  { id: "e1", name: "Avery" },
  { id: "e2", name: "Jordan" },
  { id: "e3", name: "Sam" },
  { id: "e4", name: "Taylor" },
  { id: "e5", name: "Riley" },
  { id: "e6", name: "Morgan" },
];

const demoTasks = [
  { id: "t1", type: "front", label: "Front Desk", col: 0, startRow: 2, span: 4 },
  { id: "t2", type: "gallery", label: "Gallery Floor", col: 1, startRow: 2, span: 4 },
  { id: "t3", type: "tour", label: "Public Tour", col: 3, startRow: 3, span: 5 },
  { id: "t4", type: "break", label: "Break", col: 4, startRow: 8, span: 4 },
  { id: "t5", type: "school-program", label: "School Program", col: 1, startRow: 9, span: 5 },
  { id: "t6", type: "prep", label: "Prep", col: 2, startRow: 9, span: 5 },
  { id: "t7", type: "tidy", label: "Finish", col: 5, startRow: 9, span: 5 },
  { id: "t8", type: "front", label: "Front Desk", col: 3, startRow: 14, span: 4 },
  { id: "t9", type: "gallery", label: "Gallery Floor", col: 4, startRow: 14, span: 4 },
  { id: "t10", type: "school-pre", label: "School Pre", col: 2, startRow: 18, span: 4 },
  { id: "t11", type: "tour", label: "Public Tour", col: 0, startRow: 18, span: 5 },
  { id: "t12", type: "break", label: "Break", col: 5, startRow: 19, span: 4 },
];

function downloadXLS(html: string) {
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roster-demo.xls";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

export default function LandingSoftwareDemo() {
  const [hours, setHours] = useState({ start: "08:00", end: "17:00" });
  const dateLabel = useMemo(() => formatFullDay(demoDate), []);

  return (
    <div className="overflow-hidden rounded-[18px] border border-[#ccd6eb] bg-[#f5f6fa] shadow-[0_18px_50px_rgba(27,42,68,0.18)]">
      <div className="relative flex h-12 items-center justify-center bg-[var(--accent)] px-4">
        <p className="text-base font-semibold text-white">Roster Editor</p>
        <span className="absolute right-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-semibold text-[var(--accent)]">
          AB
        </span>
      </div>

      <div className="grid md:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-[#e0e3ea] bg-white p-3 md:flex md:flex-col">
          <div className="px-3 pb-3 pt-1">
            <p className="text-[0.95rem] font-semibold text-[#2f3a52]">
              Roster Generator
            </p>
          </div>

          <div className="space-y-1 px-2">
            <a className="inline-flex h-10 w-full items-center gap-2.5 rounded-[10px] px-4 text-left text-[14px] font-medium text-[#384462] hover:bg-[#f3f4f7]">
              <CalendarDays className="h-4 w-4 text-[#6b768f]" />
              Rosters
            </a>
            <a className="inline-flex h-10 w-full items-center gap-2.5 rounded-[10px] bg-[#e8e9fb] px-4 text-left text-[14px] font-medium text-[#3f4c84]">
              <Pencil className="h-4 w-4 text-[#4a57a1]" />
              Editor
            </a>
            <a className="inline-flex h-10 w-full items-center gap-2.5 rounded-[10px] px-4 text-left text-[14px] font-medium text-[#384462] hover:bg-[#f3f4f7]">
              <Users className="h-4 w-4 text-[#6b768f]" />
              People
            </a>
            <a className="inline-flex h-10 w-full items-center gap-2.5 rounded-[10px] px-4 text-left text-[14px] font-medium text-[#384462] hover:bg-[#f3f4f7]">
              <FolderOpen className="h-4 w-4 text-[#6b768f]" />
              Tasks
            </a>
            <a className="inline-flex h-10 w-full items-center gap-2.5 rounded-[10px] px-4 text-left text-[14px] font-medium text-[#384462] hover:bg-[#f3f4f7]">
              <Settings className="h-4 w-4 text-[#6b768f]" />
              Settings
            </a>
          </div>

          <div className="mt-auto px-3 pt-4">
            <p className="text-center text-[12px] text-[#707991]">
              Powered by rostergenerator.app
            </p>
            <p className="mt-1 text-center text-[11px] text-[#707991]">
              Demo workspace
            </p>
          </div>
        </aside>

        <div className="w-full p-2 sm:p-3 md:p-4">
          <div className="space-y-4">
            <h2 className="break-words text-[clamp(1.2rem,4.8vw,2rem)] font-semibold leading-tight text-[#1f2733]">
              {dateLabel}
            </h2>

            <div className="sticky top-2 z-20 w-full">
              <TopBar
                hours={hours}
                onHoursStartChange={(value) =>
                  setHours((prev) => ({ ...prev, start: value }))
                }
                onHoursEndChange={(value) =>
                  setHours((prev) => ({ ...prev, end: value }))
                }
                onHoursDefault={() => setHours({ start: "08:00", end: "17:00" })}
              />
            </div>

            <Grid
              employees={demoEmployees}
              initialTasks={demoTasks}
              rosterDateId="2026-03-30-demo"
              rosterDate={demoDate}
              hoursStart={hours.start}
              hoursEnd={hours.end}
              onExportXLS={downloadXLS}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

