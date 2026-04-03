"use client";
import React from "react";
import { Download, Plus, Sparkles, Save, RotateCcw, Trash2, Undo2, Redo2 } from "lucide-react";

export default function TopBar({
  showActions = true,
  hours,
  onHoursStartChange,
  onHoursEndChange,
  onHoursDefault,
}: {
  showActions?: boolean;
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

  return (
    <header className="rounded-[12px] border border-[var(--border)] bg-[var(--surface-subtle)] px-3 py-2">
      <div className="flex min-h-[38px] w-full items-start gap-2 sm:items-center">
        {showActions && (
          <div className="min-w-0 flex-1">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:w-max sm:items-center sm:gap-2">
              <button className="btn h-9 w-full justify-center whitespace-nowrap text-[13px] sm:w-auto" onClick={handleUndo}>
                <Undo2 className="w-4 h-4" /> Undo
              </button>
              <button className="btn h-9 w-full justify-center whitespace-nowrap text-[13px] sm:w-auto" onClick={handleRedo}>
                <Redo2 className="w-4 h-4" /> Redo
              </button>
              <button className="btn h-9 w-full justify-center whitespace-nowrap text-[13px] sm:w-auto" onClick={handleAddEmployee}>
                <Plus className="w-4 h-4" /> Add person
              </button>
              <button className="btn h-9 w-full justify-center whitespace-nowrap text-[13px] sm:w-auto" onClick={handleAutofill}>
                <Sparkles className="w-4 h-4" /> Autofill
              </button>
              <button className="btn h-9 w-full justify-center whitespace-nowrap text-[13px] sm:w-auto" onClick={handleSave}>
                <Save className="w-4 h-4" /> Save
              </button>
              <button className="btn h-9 w-full justify-center whitespace-nowrap text-[13px] sm:w-auto" onClick={handleClear}>
                <Trash2 className="w-4 h-4" /> Clear
              </button>
              <button className="btn h-9 w-full justify-center whitespace-nowrap text-[13px] sm:w-auto" onClick={handleExport}>
                <Download className="w-4 h-4" /> Export
              </button>
              <button
                className="btn h-9 w-full justify-center whitespace-nowrap text-[13px] sm:ml-1 sm:w-auto sm:border-l sm:border-[var(--border)] sm:pl-3"
                onClick={handleReset}
              >
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>
        )}
        {showHoursControls && (
          <div className="ml-auto hidden items-center gap-2 border-l border-[var(--border)] pl-3 sm:flex">
            <span className="text-[14px] font-semibold text-slate-700 whitespace-nowrap">Hours</span>
            <input
              type="time"
              className="input h-9 w-[126px] min-w-[116px] text-[14px]"
              value={hours.start}
              step={900}
              onChange={(e) => onHoursStartChange(e.target.value)}
            />
            <span className="text-slate-500 text-[13px]">to</span>
            <input
              type="time"
              className="input h-9 w-[126px] min-w-[116px] text-[14px]"
              value={hours.end}
              step={900}
              onChange={(e) => onHoursEndChange(e.target.value)}
            />
            <button className="btn h-9 px-3" type="button" onClick={onHoursDefault}>
              Default
            </button>
          </div>
        )}
      </div>
      {showHoursControls && (
        <div className="mt-2 border-t border-[var(--border)] pt-2 sm:hidden">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-slate-700">Hours</span>
              <button className="btn h-9 px-3 text-[13px]" type="button" onClick={onHoursDefault}>
                Default
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="time"
                className="input h-10 w-full min-w-0 text-[14px]"
                value={hours.start}
                step={900}
                onChange={(e) => onHoursStartChange(e.target.value)}
              />
              <input
                type="time"
                className="input h-10 w-full min-w-0 text-[14px]"
                value={hours.end}
                step={900}
                onChange={(e) => onHoursEndChange(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
      {!showHoursControls && <div className="h-1" />}
    </header>
  );
}
