"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { type TaskTemplate } from "@/lib/taskTemplates";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const WEEKENDS = ["Sat", "Sun"];

export default function TasksClient({ initialTasks }: { initialTasks: TaskTemplate[] }) {
  const [tasks, setTasks] = useState<TaskTemplate[]>(initialTasks);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    setTasks(initialTasks);
    setSelectedIds([]);
  }, [initialTasks]);

  function formatOccurrence(days: string[] | undefined) {
    if (!days || days.length === 0) return "Not set";
    const uniq = Array.from(new Set(days));
    if (uniq.length === 7) return "Daily";
    const isWeekdays = WEEKDAYS.every((d) => uniq.includes(d)) && uniq.every((d) => WEEKDAYS.includes(d));
    if (isWeekdays) return "Weekdays";
    const isWeekends = WEEKENDS.every((d) => uniq.includes(d)) && uniq.every((d) => WEEKENDS.includes(d));
    if (isWeekends) return "Weekends";
    return uniq.join(", ");
  }

  const summaries = useMemo(
    () =>
      tasks.map((t) => ({
        ...t,
        occurrence: formatOccurrence(t.regularDays),
      })),
    [tasks]
  );

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = selectedIds.length > 0 && selectedIds.length < summaries.length;
  }, [selectedIds, summaries.length]);

  async function addTask() {
    const name = prompt("New task name?");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const description = prompt("Short description for this task?") || "";
    const category = prompt("Category for this task? (optional)") || "";
    const color = prompt("Colour (hex or css value)? Leave blank for default.", "") || "";

    try {
      const res = await fetch("/api/task-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, description, category, color }),
      });
      if (!res.ok) throw new Error("Failed to add template");
      const created = await res.json();
      setTasks((prev) => [...prev, created]);
    } catch (err) {
      console.error(err);
      alert("Failed to add task template");
    }
  }

  return (
    <div className="w-full py-3 px-3">
      <div className="space-y-3 flex flex-col items-start w-full">
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-2xl font-semibold">Tasks</h1>
            <p className="text-slate-600 text-[14px]">Manage reusable task templates for roster planning.</p>
          </div>
          <button className="btn btn-primary px-4 py-2" style={{ borderRadius: "6px" }} onClick={addTask}>
            <Plus className="w-4 h-4 text-white" strokeWidth={2.3} />
            <span className="text-[14px] font-medium">Add task</span>
          </button>
        </div>

        <div className="w-full overflow-hidden rounded-lg border border-[var(--border)] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm border-collapse">
              <colgroup>
                <col className="w-10" />
                <col className="w-[34%]" />
                <col className="w-[24%]" />
                <col />
              </colgroup>
              <thead className="text-slate-600 text-sm">
                <tr className="border-b border-[#E6EAF0]">
                  <th className="w-10 px-3 py-3 text-left font-semibold">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Select all"
                      checked={selectedIds.length > 0 && selectedIds.length === summaries.length}
                      onChange={(e) => setSelectedIds(e.target.checked ? summaries.map((s) => String(s.id)) : [])}
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">Task</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                  <th className="px-3 py-3 text-left font-semibold">Occurance</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[#E6EAF0] hover:bg-[#f8fafc] cursor-pointer"
                    onMouseEnter={() => router.prefetch(`/tasks/${t.id}`)}
                    onClick={() => router.push(`/tasks/${t.id}`)}
                  >
                    <td className="align-middle px-3 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        aria-label={`Select ${t.name}`}
                        checked={selectedIds.includes(String(t.id))}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const set = new Set(prev);
                            if (e.target.checked) set.add(String(t.id));
                            else set.delete(String(t.id));
                            return Array.from(set);
                          });
                        }}
                      />
                    </td>
                    <td className="align-middle px-3 py-3">
                      <span className="flex min-w-0 items-center gap-2 font-semibold text-slate-800">
                        <span
                          className="inline-block w-[18px] h-[18px] rounded-full border border-slate-400"
                          style={{ backgroundColor: t.color || "#fff" }}
                          aria-label={`Colour ${t.color || "default"}`}
                          title={t.color || "default"}
                        />
                        <span className="truncate">{t.name}</span>
                      </span>
                    </td>
                    <td className="align-middle px-3 py-3 text-slate-600">
                      <span className="block truncate">{t.enabled === false ? "Disabled" : "Enabled"}</span>
                    </td>
                    <td className="align-middle px-3 py-3 text-slate-600">
                      <span className="block truncate">{t.occurrence}</span>
                    </td>
                  </tr>
                ))}
                {summaries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-600">No tasks yet. Add one to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[var(--border)] px-4 py-3 text-sm text-slate-600">{summaries.length} task{summaries.length === 1 ? "" : "s"}</div>
        </div>
      </div>
    </div>
  );
}
