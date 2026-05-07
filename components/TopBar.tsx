"use client";
import React from "react";
import { Download, Plus, Sparkles, Save, RotateCcw, Undo2, Redo2, Upload } from "lucide-react";

export default function TopBar({
  showActions = true,
  merged = false,
  hours,
  onHoursStartChange,
  onHoursEndChange,
  onHoursDefault,
  schoolTourUploadLabel = "Upload school tours",
}: {
  showActions?: boolean;
  merged?: boolean;
  hours?: { start: string; end: string };
  onHoursStartChange?: (value: string) => void;
  onHoursEndChange?: (value: string) => void;
  onHoursDefault?: () => void;
  schoolTourUploadLabel?: string;
}) {
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const [isDraggingSchoolTours, setIsDraggingSchoolTours] = React.useState(false);

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
  function handleAutofill() {
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
  function dispatchSchoolTourFile(file: File | null | undefined) {
    if (!file || typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("roster:import-school-tours", { detail: { file } }));
  }
  function handleSchoolTourButtonClick() {
    uploadInputRef.current?.click();
  }
  function handleSchoolTourInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    dispatchSchoolTourFile(file);
    event.target.value = "";
  }
  function handleSchoolTourDragOver(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (!isDraggingSchoolTours) setIsDraggingSchoolTours(true);
  }
  function handleSchoolTourDragLeave(event: React.DragEvent<HTMLButtonElement>) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setIsDraggingSchoolTours(false);
  }
  function handleSchoolTourDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setIsDraggingSchoolTours(false);
    const file = Array.from(event.dataTransfer.files).find((candidate) =>
      candidate.name.toLowerCase().endsWith(".xlsx")
    );
    dispatchSchoolTourFile(file);
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
    ? "relative self-start max-w-full overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)]"
    : "relative z-10 self-start max-w-full overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_20px_rgba(16,24,40,0.04)]";
  const segmentClassName =
    "inline-flex h-10 shrink-0 items-center justify-center gap-2 border-r border-[var(--border)] px-3 text-[13px] font-semibold text-[var(--ink)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(51,34,139,0.14)] focus-visible:ring-inset";
  const actionSegmentClassName =
    `${segmentClassName} bg-[var(--surface)] hover:bg-[var(--surface-subtle)]`;
  const iconOnlySegmentClassName =
    "inline-flex h-10 w-9 shrink-0 items-center justify-center border-r border-[var(--border)] text-[var(--ink)] transition hover:bg-[var(--surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(51,34,139,0.14)] focus-visible:ring-inset";
  const hoursGroupClassName =
    "flex h-10 shrink-0 items-center gap-1 border-r border-[var(--border)] bg-[var(--surface)] px-2";
  const uploadSegmentClassName = `inline-flex h-10 min-w-[200px] shrink-0 items-center justify-center gap-2 border-r px-3 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(51,34,139,0.14)] focus-visible:ring-inset ${
    isDraggingSchoolTours
      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
      : "border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
  }`;
  const hoursSpacerClassName =
    "shrink-0 px-0.5 text-[12px] font-semibold text-[var(--muted-strong)]";
  const hoursInputClassName =
    "input time-input-no-icon h-8 w-[100px] min-w-[100px] appearance-none rounded-[8px] border border-transparent bg-transparent px-2.5 pr-2.5 text-[13px] font-semibold tabular-nums text-[var(--ink)] shadow-none outline-none transition focus:border-[rgba(51,34,139,0.34)] focus:bg-[var(--surface-subtle)] focus:ring-2 focus:ring-[rgba(51,34,139,0.11)]";
  if (!actionButtons.length && !showHoursControls) return null;

  return (
    <header className={containerClassName}>
      <input
        ref={uploadInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={handleSchoolTourInputChange}
      />
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
          <button
            type="button"
            className={uploadSegmentClassName}
            onClick={handleSchoolTourButtonClick}
            onDragOver={handleSchoolTourDragOver}
            onDragLeave={handleSchoolTourDragLeave}
            onDrop={handleSchoolTourDrop}
            aria-label={schoolTourUploadLabel}
            title="Upload or drop a school tours Excel file"
          >
            <Upload className="h-4 w-4" />
            <span>{isDraggingSchoolTours ? "Drop school tours" : schoolTourUploadLabel}</span>
          </button>
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
