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
  const actionButtons = showActions
    ? [
        { key: "undo", label: "Undo", icon: Undo2, onClick: handleUndo, primary: false },
        { key: "redo", label: "Redo", icon: Redo2, onClick: handleRedo, primary: false },
        { key: "add", label: "Add person", icon: Plus, onClick: handleAddEmployee, primary: false },
        { key: "autofill", label: "Autofill", icon: Sparkles, onClick: handleAutofill, primary: false },
        { key: "save", label: "Save", icon: Save, onClick: handleSave, primary: true },
        { key: "clear", label: "Clear", icon: Trash2, onClick: handleClear, primary: false },
        { key: "export", label: "Export", icon: Download, onClick: handleExport, primary: false },
        { key: "reset", label: "Reset", icon: RotateCcw, onClick: handleReset, primary: false },
      ]
    : [];
  const containerClassName = merged
    ? "w-full overflow-hidden rounded-[14px] border border-[#d7deea] bg-white"
    : "relative z-10 w-full overflow-hidden rounded-[14px] border border-[#d7deea] bg-white shadow-[0_12px_26px_rgba(15,23,42,0.08)]";
  const segmentClassName =
    "inline-flex h-11 shrink-0 items-center justify-center gap-2 border-r border-[#d7deea] px-4 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(52,77,232,0.16)] focus-visible:ring-inset";
  const actionSegmentClassName =
    `${segmentClassName} bg-white text-slate-700 hover:bg-[#f8fafc] hover:text-slate-900`;
  const primarySegmentClassName =
    `${segmentClassName} bg-slate-900 text-white hover:bg-slate-800`;
  const hoursLabelClassName =
    "flex h-11 shrink-0 items-center border-r border-[#d7deea] bg-[#f8fafc] px-4 text-[13px] font-semibold text-slate-700";
  const hoursSpacerClassName =
    "flex h-11 shrink-0 items-center border-r border-[#d7deea] bg-[#f8fafc] px-3 text-[13px] text-slate-500";
  const hoursInputWrapClassName =
    "flex h-11 shrink-0 items-center border-r border-[#d7deea] bg-[#f8fafc] px-2";
  const hoursInputClassName =
    "h-8 w-[122px] min-w-[122px] rounded-[8px] border border-transparent bg-transparent px-3 text-[14px] text-slate-700 outline-none transition focus:border-[rgba(52,77,232,0.35)] focus:bg-white focus:ring-2 focus:ring-[rgba(52,77,232,0.12)]";
  const defaultSegmentClassName =
    `${segmentClassName} bg-[#f8fafc] text-slate-700 hover:bg-[#eef3f8] hover:text-slate-900`;

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
                className={`${action.primary ? primarySegmentClassName : actionSegmentClassName} ${isFinalSegment ? "border-r-0" : ""}`}
                onClick={action.onClick}
              >
                <Icon className="h-4 w-4" />
                {action.label}
              </button>
            );
          })}
          {showHoursControls && (
            <>
              <div className={hoursLabelClassName}>Hours</div>
              <div className={hoursInputWrapClassName}>
                <input
                  type="time"
                  className={hoursInputClassName}
                  value={hours.start}
                  step={900}
                  onChange={(e) => onHoursStartChange(e.target.value)}
                />
              </div>
              <div className={hoursSpacerClassName}>to</div>
              <div className={hoursInputWrapClassName}>
                <input
                  type="time"
                  className={hoursInputClassName}
                  value={hours.end}
                  step={900}
                  onChange={(e) => onHoursEndChange(e.target.value)}
                />
              </div>
              <button className={`${defaultSegmentClassName} border-r-0`} type="button" onClick={onHoursDefault}>
                Default
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
