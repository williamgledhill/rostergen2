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
  highlighted?: boolean;
  isFirstCol?: boolean;
  isLastCol?: boolean;
  touchesBottomEdge?: boolean;
  onSelect?: () => void;
  onStartResize?: (which: "top" | "bottom", e: React.MouseEvent) => void;
};

export default function Block({
  id,
  type,
  label,
  col,
  startRow,
  span,
  selected,
  highlighted,
  isFirstCol,
  touchesBottomEdge,
  onSelect,
  onStartResize,
  isLastCol,
  color,
  waitingMinutes,
  packingMinutes,
}: Props) {
  const cls = color ? "" : "bg-slate-200";
  const boxShadow = [
    !isLastCol ? "inset -1px 0 0 rgba(71,85,105,0.98)" : "",
    !touchesBottomEdge ? "inset 0 -1px 0 rgba(71,85,105,0.98)" : "",
    selected ? "inset 0 0 0 2px rgba(15,23,42,0.82)" : "",
  ]
    .filter(Boolean)
    .join(", ");
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
      className={`relative ${cls} flex items-center justify-center text-center select-none overflow-hidden`}
      style={{
        gridColumn: String(col),
        gridRow: `${startRow} / span ${span}`,
        backgroundColor: color || undefined,
        boxShadow,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(); }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ display: "flex", flexDirection: "column" }}
      >
        {segments.map((seg, idx) => (
          <div
            key={seg.key}
            className="flex items-center justify-center overflow-hidden"
            style={{
              height: `calc(var(--rowh) * ${seg.rows})`,
              flexShrink: 0,
              boxShadow:
                idx < segments.length - 1 ? "inset 0 -1px 0 rgba(71,85,105,0.98)" : undefined,
            }}
          >
            <span
              className={`block w-full overflow-hidden px-1.5 text-center font-semibold leading-[1.05] ${
                seg.key === "main"
                  ? "text-[11px] tracking-[0.02em] whitespace-normal break-words"
                  : "text-[10px] uppercase tracking-[0.06em] whitespace-normal break-words"
              }`}
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: seg.rows >= 3 ? 3 : seg.rows >= 2 ? 2 : 1,
              }}
            >
              {seg.label}
            </span>
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
