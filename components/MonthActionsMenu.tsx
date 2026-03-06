"use client";

import React, { useEffect, useRef, useState } from "react";
import { Archive, Settings, Trash2 } from "lucide-react";

export default function MonthActionsMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full flex justify-end">
      <button
        type="button"
        className="btn h-10 w-10 px-0"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Settings className="w-6 h-6 text-slate-600" />
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-44 rounded-lg border border-[#CBD5E1] bg-white shadow-lg z-10"
          role="menu"
        >
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-[#f5f7fa] flex items-center gap-2"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Archive className="w-4 h-4 text-slate-500" />
            <span>Archive</span>
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-[#fef2f2] flex items-center gap-2"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Trash2 className="w-4 h-4 text-red-500" />
            <span>Move to bin</span>
          </button>
        </div>
      )}
    </div>
  );
}
