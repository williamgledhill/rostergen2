"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Props = {
  existingMonthIds: string[];
};

export default function NewMonthButton({ existingMonthIds }: Props) {
  const router = useRouter();
  const now = useMemo(() => new Date(), []);
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const existingSet = useMemo(() => new Set(existingMonthIds), [existingMonthIds]);

  function monthId(monthIdx: number) {
    const m = String(monthIdx + 1).padStart(2, "0");
    return `${year}-${m}`;
  }

  useEffect(() => {
    // clear selection when changing year
    setSelectedMonth(null);
  }, [year]);

  function handleSelect(monthIdx: number) {
    const id = monthId(monthIdx);
    if (existingSet.has(id)) return;
    setSelectedMonth(monthIdx);
  }

  function changeYear(delta: number) {
    setYear((y) => y + delta);
  }

  function handleAddMonth() {
    if (selectedMonth === null) return;
    const id = monthId(selectedMonth);
    if (existingSet.has(id)) return;
    setOpen(false);
    router.push(`/rosters/months/${id}`);
  }

  return (
    <>
      <button className="btn btn-primary h-9" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 text-white" strokeWidth={2.3} />
        <span>New month</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[2147483647] bg-black/40 flex items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-[8px] w-full max-w-xl shadow-xl border border-[var(--border)] overflow-hidden mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold">New month</h2>
                <p className="text-sm text-slate-600">Pick a month to create or open.</p>
              </div>
              <button
                className="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-[#f5f7fa] transition"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 pb-5 space-y-4">
              <div className="flex items-center gap-3">
                <button className="btn h-8 px-2" onClick={() => changeYear(-1)} aria-label="Previous year">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <div className="text-lg font-semibold min-w-[90px] text-center">{year}</div>
                <button className="btn h-8 px-2" onClick={() => changeYear(1)} aria-label="Next year">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {MONTHS.map((name, idx) => {
                  const id = monthId(idx);
                  const disabled = existingSet.has(id);
                  const isSelected = selectedMonth === idx;
                  const selectedStyle = isSelected
                    ? { borderColor: "rgb(103, 93, 255)", borderWidth: 2 }
                    : undefined;
                  return (
                    <button
                      key={id}
                      className={`btn w-full justify-center ${
                        disabled
                          ? "text-slate-400 border-dashed cursor-not-allowed"
                          : isSelected
                            ? "bg-white hover:border-[#675dff] hover:bg-[#f5f7fa]"
                            : "hover:bg-[#f5f7fa] hover:border-[#94a3b8]"
                      }`}
                      onClick={() => handleSelect(idx)}
                      disabled={disabled}
                      aria-disabled={disabled}
                      title={disabled ? "Month already exists" : `Create/open ${name} ${year}`}
                      style={selectedStyle}
                    >
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-end gap-3 bg-white">
              <button
                className="btn h-8 px-3 text-black/80 hover:text-black"
                style={{ boxShadow: "inset 0 0 0 1px #CFCFCF", border: "none", background: "white" }}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary h-9 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ borderRadius: "6px", paddingInline: "12px" }}
                onClick={handleAddMonth}
                disabled={selectedMonth === null || existingSet.has(monthId(selectedMonth))}
              >
                <Plus className="w-4 h-4 text-white" strokeWidth={2.3} />
                <span className="text-[14px] font-medium text-white">Open month</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
