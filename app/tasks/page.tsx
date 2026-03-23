"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { TaskTemplate, defaultTaskTemplates } from "@/lib/taskTemplates";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const WEEKENDS = ["Sat", "Sun"];

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskTemplate[]>(defaultTaskTemplates);
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  function formatOccurrence(days: string[] | undefined) {
    if (!days || days.length === 0) return "Not set";
    const uniq = Array.from(new Set(days));
    const isDaily = uniq.length === 7;
    if (isDaily) return "Daily";
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
        badge: t.category || "Template",
        initial: t.name?.[0]?.toUpperCase() || "T",
        occurrence: formatOccurrence(t.regularDays),
      })),
    [tasks]
  );

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(summaries.map((s) => String(s.id)));
    } else {
      setSelectedIds([]);
    }
  }

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const isIndeterminate = selectedIds.length > 0 && selectedIds.length < summaries.length;
    el.indeterminate = isIndeterminate;
  }, [selectedIds, summaries.length]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/task-templates");
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (!active) return;
        if (Array.isArray(data) && data.length) {
          setTasks(data);
        }
      } catch (err) {
        console.error(err);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

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

        <div className="bg-white rounded-lg shadow-sm w-full overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="text-slate-600 text-sm">
                <tr className="border-b border-[#E6EAF0]">
                  <th className="w-10 px-3 py-2 text-left font-semibold">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Select all"
                      checked={selectedIds.length > 0 && selectedIds.length === summaries.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Task</th>
                  <th className="px-3 py-2 text-left font-semibold">Status</th>
                  <th className="px-3 py-2 text-left font-semibold">Occurance</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[#E6EAF0] hover:bg-[#f8fafc] cursor-pointer"
                    onClick={() => router.push(`/tasks/${t.id}`)}
                  >
                    <td className="align-middle px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        aria-label={`Select ${t.name}`}
                        checked={selectedIds.includes(String(t.id))}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => toggleRow(String(t.id), e.target.checked)}
                      />
                    </td>
                    <td className="align-middle px-3 py-3">
                      <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
                        <span
                          className="inline-block w-[18px] h-[18px] rounded-full border border-slate-400"
                          style={{ backgroundColor: t.color || "#fff" }}
                          aria-label={`Colour ${t.color || "default"}`}
                          title={t.color || "default"}
                        />
                        <span>{t.name}</span>
                      </span>
                    </td>
                    <td className="align-middle px-3 py-2 text-[13px] text-slate-600">
                      {t.enabled === false ? "Disabled" : "Enabled"}
                    </td>
                    <td className="align-middle px-3 py-2 text-slate-600 text-[13px]">
                      {t.occurrence}
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
          <div className="px-4 py-3 text-sm text-slate-600">{summaries.length} task{summaries.length === 1 ? "" : "s"}</div>
        </div>
      </div>
    </div>
  );
}

