"use client";
import React from "react";
import { Download, Plus, Sparkles, Save, RotateCcw, Undo2, Redo2 } from "lucide-react";

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
    typeof onHoursEndChange === "function";
  const actionButtons = showActions
    ? [
        { key: "autofill", label: "Autofill", icon: Sparkles, onClick: handleAutofill },
        { key: "undo", label: "Undo", icon: Undo2, onClick: handleUndo, iconOnly: true },
        { key: "redo", label: "Redo", icon: Redo2, onClick: handleRedo, iconOnly: true },
        { key: "add", label: "Add person", icon: Plus, onClick: handleAddEmployee },
        { key: "save", label: "Save", icon: Save, onClick: handleSave },
        { key: "export", label: "Export", icon: Download, onClick: handleExport },
        { key: "reset", label: "Reset", icon: RotateCcw, onClick: handleReset },
      ]
    : [];
  const containerClassName = merged
    ? "relative self-start max-w-full overflow-hidden rounded-[14px] border border-[#d7deea] bg-white"
    : "relative z-10 self-start max-w-full overflow-hidden rounded-[14px] border border-[#d7deea] bg-white shadow-[0_12px_26px_rgba(15,23,42,0.08)]";
  const segmentClassName =
    "inline-flex h-11 shrink-0 items-center justify-center gap-2 border-r border-[#d7deea] px-3 text-[14px] font-semibold text-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(52,77,232,0.16)] focus-visible:ring-inset";
  const actionSegmentClassName =
    `${segmentClassName} bg-white hover:bg-[#f8fafc]`;
  const iconOnlySegmentClassName =
    "inline-flex h-11 w-10 shrink-0 items-center justify-center border-r border-[#d7deea] text-slate-800 transition hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(52,77,232,0.16)] focus-visible:ring-inset";
  const hoursGroupClassName =
    "flex h-11 shrink-0 items-center gap-1 border-r border-[#d7deea] bg-white px-2";
  const hoursSpacerClassName =
    "shrink-0 px-0.5 text-[12px] font-semibold text-slate-700";
  const hoursInputClassName =
    "input time-input-no-icon h-8 w-[104px] min-w-[104px] appearance-none rounded-[8px] border border-transparent bg-transparent px-2.5 pr-2.5 text-[13px] font-semibold tabular-nums text-slate-800 shadow-none outline-none transition focus:border-[rgba(52,77,232,0.35)] focus:bg-[#f8fafc] focus:ring-2 focus:ring-[rgba(52,77,232,0.12)]";
  if (!actionButtons.length && !showHoursControls) return null;

  return (
    <header className={containerClassName}>
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-stretch">
          {actionButtons.map((action, index) => {
            const Icon = action.icon;
            const isLastAction = index === actionButtons.length - 1;
            const isFinalSegment = isLastAction && !showHoursControls;
            return (
              <button
                key={action.key}
                type="button"
                className={`${action.iconOnly ? iconOnlySegmentClassName : actionSegmentClassName} ${isFinalSegment ? "border-r-0" : ""}`}
                onClick={action.onClick}
                aria-label={action.label}
                title={action.label}
              >
                <Icon className="h-4 w-4" />
                {!action.iconOnly && action.label}
              </button>
            );
          })}
          {showHoursControls && (
            <div className={`${hoursGroupClassName} border-r-0`}>
              <input
                type="time"
                className={hoursInputClassName}
                value={hours.start}
                step={900}
                onChange={(e) => onHoursStartChange(e.target.value)}
              />
              <span className={hoursSpacerClassName}>to</span>
              <input
                type="time"
                className={hoursInputClassName}
                value={hours.end}
                step={900}
                onChange={(e) => onHoursEndChange(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
