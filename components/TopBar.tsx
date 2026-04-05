"use client";
import React from "react";
import { Download, Plus, Sparkles, Save, RotateCcw, Trash2, Undo2, Redo2 } from "lucide-react";

export default function TopBar({
  showActions = true,
  merged = false,
  hours,
  onHoursStartChange,
  onHoursEndChange,
  onHoursDefault,
}: {
  showActions?: boolean;
  merged?: boolean;
  hours?: { start: string; end: string };
  onHoursStartChange?: (value: string) => void;
  onHoursEndChange?: (value: string) => void;
  onHoursDefault?: () => void;
}) {
  function handleAddEmployee(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new CustomEvent("roster:add-employee"));
    }
  }
  function handleExport(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-export"));
    }
  }
  function handleSave(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-save"));
    }
  }
  function handleClear(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-clear"));
    }
  }
  function handleAutofill(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-autofill"));
    }
  }
  function handleUndo(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-undo"));
    }
  }
  function handleRedo(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-redo"));
    }
  }
  function handleReset(){
    if(typeof window !== "undefined"){
      window.dispatchEvent(new Event("roster-reset"));
    }
  }

  const showHoursControls =
    !!hours &&
    typeof onHoursStartChange === "function" &&
    typeof onHoursEndChange === "function" &&
    typeof onHoursDefault === "function";
  const containerClassName = merged
    ? "border-b border-[#d7deea] bg-white px-3 py-3 sm:px-4"
    : "rounded-[12px] border border-[var(--border)] bg-white p-3";
  const actionButtonClassName =
    "inline-flex h-10 items-center justify-center gap-2 rounded-[11px] border border-[#d7deea] bg-white px-3.5 text-[13px] font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-[#c4cedd] hover:bg-[#f8fafc] hover:text-slate-900";
  const primaryButtonClassName =
    "inline-flex h-10 items-center justify-center gap-2 rounded-[11px] border border-slate-900 bg-slate-900 px-3.5 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(15,23,42,0.12)] transition hover:bg-slate-800";

  return (
    <header className={containerClassName}>
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {showActions && (
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button className={actionButtonClassName} onClick={handleUndo}>
                <Undo2 className="w-4 h-4" /> Undo
              </button>
              <button className={actionButtonClassName} onClick={handleRedo}>
                <Redo2 className="w-4 h-4" /> Redo
              </button>
              <button className={actionButtonClassName} onClick={handleAddEmployee}>
                <Plus className="w-4 h-4" /> Add person
              </button>
              <button className={actionButtonClassName} onClick={handleAutofill}>
                <Sparkles className="w-4 h-4" /> Autofill
              </button>
              <button className={primaryButtonClassName} onClick={handleSave}>
                <Save className="w-4 h-4" /> Save
              </button>
              <button className={actionButtonClassName} onClick={handleClear}>
                <Trash2 className="w-4 h-4" /> Clear
              </button>
              <button className={actionButtonClassName} onClick={handleExport}>
                <Download className="w-4 h-4" /> Export
              </button>
              <button className={actionButtonClassName} onClick={handleReset}>
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>
        )}
        {showHoursControls && (
          <div className="hidden items-center gap-2 rounded-[12px] border border-[#d7deea] bg-[#f8fafc] p-1.5 sm:flex">
            <span className="text-[14px] font-semibold text-slate-700 whitespace-nowrap">Hours</span>
            <input
              type="time"
              className="input h-9 w-[126px] min-w-[116px] border-[#d7deea] text-[14px]"
              value={hours.start}
              step={900}
              onChange={(e) => onHoursStartChange(e.target.value)}
            />
            <span className="text-slate-500 text-[13px]">to</span>
            <input
              type="time"
              className="input h-9 w-[126px] min-w-[116px] border-[#d7deea] text-[14px]"
              value={hours.end}
              step={900}
              onChange={(e) => onHoursEndChange(e.target.value)}
            />
            <button className={actionButtonClassName} type="button" onClick={onHoursDefault}>
              Default
            </button>
          </div>
        )}
      </div>
      {showHoursControls && (
        <div className="mt-3 border-t border-[#d7deea] pt-3 sm:hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-slate-700">Hours</span>
              <button className={actionButtonClassName} type="button" onClick={onHoursDefault}>
                Default
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="time"
                className="input h-10 w-full min-w-0 border-[#d7deea] text-[14px]"
                value={hours.start}
                step={900}
                onChange={(e) => onHoursStartChange(e.target.value)}
              />
              <input
                type="time"
                className="input h-10 w-full min-w-0 border-[#d7deea] text-[14px]"
                value={hours.end}
                step={900}
                onChange={(e) => onHoursEndChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
      {!showHoursControls && <div className={merged ? "h-0.5" : "h-0"} />}
    </header>
  );
}
