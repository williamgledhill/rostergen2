"use client";
import React from "react";

type Props = {
  id: string | number;
  type: string;
  label: string;
  col: number;
  startRow: number;
  span: number;
  color?: string;
  waitingMinutes?: number;
  packingMinutes?: number;
  selected?: boolean;
  isLastCol?: boolean;
  onSelect?: () => void;
  onStartResize?: (which: "top" | "bottom", e: React.MouseEvent) => void;
};

const typeToClass: Record<string, string> = {
  front: "bg-[var(--front)]",
  tour: "bg-[var(--tour)]",
  prep: "bg-[var(--prep)]",
  gallery: "bg-[var(--gallery)]",
  break: "bg-[var(--break)]",
  tidy: "bg-[var(--tidy)]",
};

export default function Block({
  id,
  type,
  label,
  col,
  startRow,
  span,
  selected,
  onSelect,
  onStartResize,
  isLastCol,
  color,
  waitingMinutes,
  packingMinutes,
}: Props) {
  const cls = color ? "" : typeToClass[type] ?? "bg-[var(--gallery)]";
  const rightBorder = isLastCol ? "" : "border-r";
  const selOverlay = selected ? "shadow-[inset_0_0_0_2px_rgba(0,0,0,0.8)]" : "";
  const totalRows = Math.max(1, span);
  const waitingRows = Math.max(0, Math.round((waitingMinutes ?? 0) / 15));
  const packingRows = Math.max(0, Math.round((packingMinutes ?? 0) / 15));
  const safeWaiting = Math.min(waitingRows, totalRows - 1);
  const safePacking = Math.min(packingRows, totalRows - safeWaiting - 1);
  const mainRows = Math.max(1, totalRows - safeWaiting - safePacking);
  const segments = [
    ...(safeWaiting > 0 ? [{ key: "waiting", label: "Waiting for", rows: safeWaiting }] : []),
    { key: "main", label, rows: mainRows },
    ...(safePacking > 0 ? [{ key: "packing", label: "Packing up", rows: safePacking }] : []),
  ];
  return (
    <div
      data-id={id}
      className={`relative border-b ${rightBorder} border-black ${cls} ${selOverlay} 
                  flex items-center justify-center text-center select-none overflow-hidden`}
      style={{ gridColumn: String(col), gridRow: `${startRow} / span ${span}`, backgroundColor: color || undefined }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <div
        className="absolute inset-0 grid pointer-events-none"
        style={{ gridTemplateRows: segments.map((seg) => `${seg.rows}fr`).join(" ") }}
      >
        {segments.map((seg, idx) => (
          <div
            key={seg.key}
            className={`flex items-center justify-center ${idx > 0 ? "border-t border-black/30" : ""}`}
          >
            <span className="px-2 text-[13px] font-semibold uppercase tracking-wide">{seg.label}</span>
          </div>
        ))}
      </div>
      {selected && (
        <>
          <div className="absolute left-2 right-2 h-1 bg-slate-700/80 top-1 rounded cursor-ns-resize"
               onMouseDown={(e) => onStartResize?.("top", e)} />
          <div className="absolute left-2 right-2 h-1 bg-slate-700/80 bottom-1 rounded cursor-ns-resize"
               onMouseDown={(e) => onStartResize?.("bottom", e)} />
        </>
      )}
    </div>
  );
}
