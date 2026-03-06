"use client";
import React, { useEffect, useState } from "react";
import { TaskTemplate, defaultTaskTemplates } from "@/lib/taskTemplates";

export default function Modal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (template: TaskTemplate) => void;
}) {
  const [choices, setChoices] = useState<TaskTemplate[]>(defaultTaskTemplates);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/task-templates");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!active) return;
        if (Array.isArray(data) && data.length) {
          setChoices(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (open) load();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/25 z-[999] grid place-items-center" onClick={onClose}>
      <div className="card p-4 w-[520px] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm uppercase font-semibold mb-3">Create Task</h2>
        <div className="grid grid-cols-2 gap-2">
          {choices.map((c) => (
            <button key={c.id} onClick={() => onPick(c)} className="btn">
              <span className="inline-flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 border border-black rounded-sm"
                  style={{ backgroundColor: c.color || "#fff" }}
                  aria-hidden="true"
                />
                {c.name}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Click outside or press Esc to cancel.</p>
      </div>
    </div>
  );
}
