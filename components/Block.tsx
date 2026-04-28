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
}: Props) {
  const cls = color ? "" : "bg-slate-200";
  const boxShadow = [
    !isLastCol ? "inset -1px 0 0 rgba(71,85,105,0.98)" : "",
    !touchesBottomEdge ? "inset 0 -1px 0 rgba(71,85,105,0.98)" : "",
    selected ? "inset 0 0 0 2px rgba(15,23,42,0.82)" : "",
  ]
    .filter(Boolean)
    .join(", ");
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
      <span
        className="pointer-events-none block w-full overflow-hidden px-1.5 text-center text-[11px] font-semibold leading-[1.05] tracking-[0.02em] whitespace-normal break-words"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: span >= 3 ? 3 : span >= 2 ? 2 : 1,
        }}
      >
        {label}
      </span>
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
