"use client";
import React from "react";
import { Redo2, RotateCcw, Sparkles, Undo2, Upload, UserPlus, ZoomIn, ZoomOut } from "lucide-react";

export type TopBarActions = {
  onAutofill: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddPerson: () => void;
  onReset: () => void;
  onImportSchoolTours: (file: File) => void;
};

function Divider() {
  return <span className="mx-1 hidden h-6 w-px bg-[var(--border)] sm:block" aria-hidden="true" />;
}

/** The editor's action bar: autofill, history, people, saving, export and the day's hours. */
export default function TopBar({
  actions,
  hours,
  onHoursStartChange,
  onHoursEndChange,
  zoom,
}: {
  actions: TopBarActions;
  hours: { start: string; end: string };
  onHoursStartChange: (value: string) => void;
  onHoursEndChange: (value: string) => void;
  zoom: { canZoomOut: boolean; canZoomIn: boolean; onZoomOut: () => void; onZoomIn: () => void };
}) {
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  function importFile(file: File | null | undefined) {
    if (file) actions.onImportSchoolTours(file);
  }

  return (
    <div className="card flex flex-wrap items-center gap-2 p-2">
      <input
        ref={uploadInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={(event) => {
          importFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <button type="button" className="btn btn-primary" onClick={actions.onAutofill}>
        <Sparkles />
        Autofill
      </button>
      <div className="flex items-center">
        <button type="button" className="btn btn-ghost btn-icon" onClick={actions.onUndo} aria-label="Undo" title="Undo">
          <Undo2 />
        </button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={actions.onRedo} aria-label="Redo" title="Redo">
          <Redo2 />
        </button>
      </div>
      <Divider />
      <button type="button" className="btn btn-ghost" onClick={actions.onAddPerson}>
        <UserPlus />
        Add person
      </button>
      <button
        type="button"
        className={`btn btn-ghost ${isDragging ? "!bg-[var(--accent-soft)] !text-[var(--accent-strong)] ring-2 ring-[var(--accent)]" : ""}`}
        onClick={() => uploadInputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          importFile(Array.from(event.dataTransfer.files).find((file) => file.name.toLowerCase().endsWith(".xlsx")));
        }}
        title="Import school tours: upload or drop the daily runsheet"
        aria-label="Import school tours"
      >
        <Upload />
        {isDragging ? "Drop to import" : "School tours"}
      </button>
      <Divider />
      <div className="flex items-center gap-1.5 px-1">
        <span className="text-[13px] text-[var(--text-muted)]">Hours</span>
        <input
          type="time"
          className="input time-input-no-icon h-8 w-[92px] px-2 text-[13px] tabular-nums"
          value={hours.start}
          step={900}
          onChange={(e) => onHoursStartChange(e.target.value)}
          aria-label="Day start time"
        />
        <span className="text-[13px] text-[var(--text-muted)]">to</span>
        <input
          type="time"
          className="input time-input-no-icon h-8 w-[92px] px-2 text-[13px] tabular-nums"
          value={hours.end}
          step={900}
          onChange={(e) => onHoursEndChange(e.target.value)}
          aria-label="Day end time"
        />
      </div>

      <Divider />
      <div className="flex items-center">
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={zoom.onZoomOut}
          disabled={!zoom.canZoomOut}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={zoom.onZoomIn}
          disabled={!zoom.canZoomIn}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn />
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button type="button" className="btn btn-ghost" onClick={actions.onReset} title="Clear all tasks and restore the day's usual staff">
          <RotateCcw />
          Reset
        </button>
      </div>
    </div>
  );
}
