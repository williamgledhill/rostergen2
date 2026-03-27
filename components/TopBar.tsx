"use client";
import React from "react";
import { Download, Plus, Sparkles, Menu, Save, RotateCcw, Trash2, Undo2, Redo2 } from "lucide-react";
import { useNav } from "@/components/NavContext";

export default function TopBar({
  navOpen,
  onToggleNav,
  showActions = true,
  hours,
  onHoursStartChange,
  onHoursEndChange,
  onHoursDefault,
}: {
  navOpen?: boolean;
  onToggleNav?: () => void;
  showActions?: boolean;
  hours?: { start: string; end: string };
  onHoursStartChange?: (value: string) => void;
  onHoursEndChange?: (value: string) => void;
  onHoursDefault?: () => void;
}) {
  const nav = useNav();
  const isOpen = navOpen ?? nav.navOpen;
  const toggleNav = onToggleNav ?? nav.toggleNav;

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
      <div className="flex min-h-[38px] w-full items-center gap-2">
        {!isOpen && (
          <button
            className="btn h-9 w-9 shrink-0 p-0"
            onClick={toggleNav}
            aria-pressed={isOpen}
            title={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <Menu className="w-4 h-4" />
          </button>
        )}
        {showActions && (
          <div className="topbar-actions-scroll min-w-0 flex-1 overflow-x-auto pb-1">
            <div className="flex w-max items-center gap-2 pr-1">
              <button className="btn whitespace-nowrap" onClick={handleUndo}>
                <Undo2 className="w-4 h-4" /> Undo
              </button>
              <button className="btn whitespace-nowrap" onClick={handleRedo}>
                <Redo2 className="w-4 h-4" /> Redo
              </button>
              <button className="btn whitespace-nowrap" onClick={handleAddEmployee}>
                <Plus className="w-4 h-4" /> Add Employee
              </button>
              <button className="btn whitespace-nowrap" onClick={handleAutofill}>
                <Sparkles className="w-4 h-4" /> Autofill
              </button>
              <button className="btn whitespace-nowrap" onClick={handleSave}>
                <Save className="w-4 h-4" /> Save
              </button>
              <button className="btn whitespace-nowrap" onClick={handleClear}>
                <Trash2 className="w-4 h-4" /> Clear
              </button>
              <button className="btn whitespace-nowrap" onClick={handleExport}>
                <Download className="w-4 h-4" /> Export
              </button>
              <button className="btn whitespace-nowrap border-l border-[var(--border)] pl-3 ml-1" onClick={handleReset}>
                <RotateCcw className="w-4 h-4" /> Reset
              </button>
            </div>
          </div>
        )}
      </div>
      {showHoursControls && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-2 md:justify-end">
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
      {!showHoursControls && <div className="h-1" />}
    </header>
  );
}
