"use client";
import React, { useMemo, useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

function formatDateLabel(d: Date) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(d);
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(year, month, 1));
}

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay(); // 0-6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (null | number)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

export default function DateNavigator({ onChange, initialDate }: { onChange?: (value: Date) => void; initialDate?: Date }) {
  const [selected, setSelected] = useState<Date>(initialDate ?? new Date());
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const popRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const label = useMemo(() => formatDateLabel(selected), [selected]);
  const monthTitle = useMemo(() => monthLabel(viewYear, viewMonth), [viewYear, viewMonth]);
  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  function setDate(date: Date) {
    setSelected(date);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
    onChange?.(date);
  }

  function shiftDays(delta: number) {
    const next = new Date(selected);
    next.setDate(selected.getDate() + delta);
    setDate(next);
  }

  function prevMonth() {
    const next = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }
  function nextMonth() {
    const next = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function pickDay(day: number | null) {
    if (!day) return;
    const picked = new Date(viewYear, viewMonth, day);
    setDate(picked);
    setOpen(false);
  }

  // close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (popRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  useEffect(() => {
    if (!initialDate) return;
    const safe = new Date(initialDate);
    if (isNaN(safe.getTime())) return;
    setSelected(safe);
    setViewYear(safe.getFullYear());
    setViewMonth(safe.getMonth());
  }, [initialDate]);

  return (
    <div className="flex items-center gap-3 relative">
      <button className="btn px-3 py-2" onClick={() => shiftDays(-1)} aria-label="Previous day">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        ref={btnRef}
        className="btn whitespace-nowrap gap-2 px-4 py-2 flex items-center min-w-[220px] justify-between bg-white border border-black"
        onClick={() => setOpen((o) => !o)}
        aria-label="Select date"
      >
        <div className="flex items-center gap-2 text-left">
          <Calendar className="w-4 h-4" />
          <span className="font-semibold">{label}</span>
        </div>
        <span className="text-sm text-slate-800">▼</span>
      </button>
      <button className="btn px-3 py-2" onClick={() => shiftDays(1)} aria-label="Next day">
        <ChevronRight className="w-4 h-4" />
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute z-50 mt-2 left-1/2 -translate-x-1/2 bg-white text-black border border-black rounded-sm shadow-lg p-3 w-[260px]"
          style={{ top: "100%" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm">{monthTitle}</div>
            <div className="flex items-center gap-2">
              <button className="btn px-2 py-1" onClick={prevMonth} aria-label="Previous month">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="btn px-2 py-1" onClick={nextMonth} aria-label="Next month">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 text-xs font-semibold text-center mb-2">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 text-sm">
            {days.map((day, idx) => {
              const isSelected = day === selected.getDate() && viewMonth === selected.getMonth() && viewYear === selected.getFullYear();
              return (
                <button
                  key={idx}
                  className={`h-9 border ${day ? "border-black hover:bg-slate-100" : "border-transparent"} ${isSelected ? "bg-black text-white border-black" : "bg-white text-black"}`}
                  onClick={() => pickDay(day)}
                  disabled={!day}
                >
                  {day || ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
