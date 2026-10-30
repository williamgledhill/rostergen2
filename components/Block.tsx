"use client";
import React from "react";
import type { TaskSegmentRows } from "@/lib/taskSegments";

type Props = {
  id: string | number;
  label: string;
  col: number;
  startRow: number;
  span: number;
  color?: string;
  segments: TaskSegmentRows;
  selected?: boolean;
  /** Being dragged to a new position. */
  dragging?: boolean;
  /** Label for the lead-in block, e.g. "Waiting for tour". */
  waitingLabel?: string;
  drawTop?: boolean;
  drawLeft?: boolean;
  onSelect?: () => void;
  onStartMove?: (e: React.MouseEvent) => void;
  onStartResize?: (which: "top" | "bottom", e: React.MouseEvent) => void;
};

const LINE = "var(--block-line)";

export default function Block({
  id,
  label,
  col,
  startRow,
  span,
  color,
  segments,
  selected,
  dragging,
  waitingLabel = "Waiting for",
  drawTop = true,
  drawLeft = true,
  onSelect,
  onStartMove,
  onStartResize,
}: Props) {
  const boxShadow = [
    `inset -1px 0 0 ${LINE}`,
    `inset 0 -1px 0 ${LINE}`,
    drawTop ? `inset 0 1px 0 ${LINE}` : "",
    drawLeft ? `inset 1px 0 0 ${LINE}` : "",
    selected ? "inset 0 0 0 2px var(--accent)" : "",
  ]
    .filter(Boolean)
    .join(", ");
  const parts = [
    ...(segments.waitingRows > 0 ? [{ key: "waiting", label: waitingLabel, rows: segments.waitingRows }] : []),
    { key: "main", label, rows: segments.mainRows },
    ...(segments.packingRows > 0 ? [{ key: "packing", label: "Packing up", rows: segments.packingRows }] : []),
  ];

  return (
    <div
      data-id={id}
      className={`relative ${color ? "" : "bg-slate-200"} flex select-none items-center justify-center overflow-hidden text-center ${
        dragging ? "z-20 cursor-grabbing opacity-90 shadow-[var(--shadow-lg)] ring-2 ring-[var(--accent)]" : selected ? "z-10 cursor-grab" : "cursor-grab"
      }`}
      style={{
        gridColumn: String(col),
        gridRow: `${startRow} / span ${span}`,
        backgroundColor: color || undefined,
        boxShadow,
      }}
      onMouseDown={onStartMove}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        {parts.map((part, idx) => (
          <div
            key={part.key}
            className="flex shrink-0 items-start justify-center overflow-hidden pt-px"
            style={{
              height: `calc(var(--rowh) * ${part.rows})`,
              boxShadow: idx < parts.length - 1 ? `inset 0 -1px 0 ${LINE}` : undefined,
            }}
          >
            <span
              className="block w-full overflow-hidden whitespace-normal break-words px-1.5 text-center text-[length:var(--grid-font)] leading-[1.25] text-slate-900"
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: Math.max(1, Math.min(3, part.rows)),
              }}
            >
              {part.label}
            </span>
          </div>
        ))}
      </div>
      {selected && (
        <>
          {(["top", "bottom"] as const).map((edge) => (
            <div
              key={edge}
              className={`absolute inset-x-0 flex h-3 cursor-ns-resize justify-center ${edge === "top" ? "top-0 items-start pt-0.5" : "bottom-0 items-end pb-0.5"}`}
              onMouseDown={(e) => onStartResize?.(edge, e)}
              title="Drag to resize"
            >
              <span className="h-1.5 w-9 rounded-full bg-[var(--accent)] shadow-sm" />
            </div>
          ))}
        </>
      )}
    </div>
  );
}
