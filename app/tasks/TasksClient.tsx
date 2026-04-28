"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { navigateWithinSpa } from "@/lib/spaNavigation";
import { preloadWorkspaceRoute, tasksDataKey, writeCachedResource } from "@/lib/workspaceData";
import {
  TASK_TEMPLATE_DELETED_STORAGE_KEY,
  TASK_TEMPLATE_REFRESH_EVENT,
  TASK_TEMPLATE_REFRESH_STORAGE_KEY,
  type TaskTemplate,
} from "@/lib/taskTemplates";

export default function TasksClient({ initialTasks }: { initialTasks: TaskTemplate[] }) {
  const [tasks, setTasks] = useState<TaskTemplate[]>(initialTasks);
  const router = useRouter();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const removePendingDeletedTask = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const deletedId = window.sessionStorage.getItem(TASK_TEMPLATE_DELETED_STORAGE_KEY);
      if (!deletedId) return;
      window.sessionStorage.removeItem(TASK_TEMPLATE_DELETED_STORAGE_KEY);
      setTasks((prev) => {
        const next = prev.filter((task) => task.id !== deletedId);
        writeCachedResource(tasksDataKey(), next);
        return next;
      });
    } catch (error) {
      console.error(error);
    }
  }, []);

  const refreshTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/task-templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to refresh tasks");
      const next = (await res.json()) as TaskTemplate[];
      writeCachedResource(tasksDataKey(), next);
      setTasks(next);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    removePendingDeletedTask();
    void refreshTasks();

    const handleRefresh = () => {
      removePendingDeletedTask();
      void refreshTasks();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === TASK_TEMPLATE_REFRESH_STORAGE_KEY) handleRefresh();
    };

    window.addEventListener(TASK_TEMPLATE_REFRESH_EVENT, handleRefresh);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(TASK_TEMPLATE_REFRESH_EVENT, handleRefresh);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshTasks, removePendingDeletedTask]);

  async function addTask() {
    const name = prompt("New task name?");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const color = prompt("Colour (hex or css value)? Leave blank for default.", "") || "";

    try {
      const res = await fetch("/api/task-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color }),
      });
      if (!res.ok) throw new Error("Failed to add template");
      const created = await res.json();
      setTasks((prev) => {
        const next = [...prev, created];
        writeCachedResource(tasksDataKey(), next);
        return next;
      });
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
            <table className="w-full table-fixed border-collapse text-[15px]">
              <colgroup>
                <col />
              </colgroup>
              <thead className="text-[15px] text-slate-900">
                <tr className="border-b border-[#E6EAF0]">
                  <th className="px-4 py-4 text-left font-bold tracking-[0.01em]">Task</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-b-0">
                {tasks.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[#E6EAF0] hover:bg-[#f8fafc] cursor-pointer"
                    onMouseEnter={() => {
                      const href = `/tasks/${t.id}`;
                      preloadWorkspaceRoute(href);
                      router.prefetch(href);
                    }}
                    onClick={() => {
                      const href = `/tasks/${t.id}`;
                      if (!navigateWithinSpa(href)) router.push(href);
                    }}
                  >
                    <td className="align-middle px-4 py-4">
                      <span className="flex min-w-0 items-center gap-3 text-[15px] font-medium text-slate-700">
                        <span
                          className="inline-block h-5 w-5 rounded-full border border-slate-400"
                          style={{ backgroundColor: t.color || "#fff" }}
                          aria-label={`Colour ${t.color || "default"}`}
                          title={t.color || "default"}
                        />
                        <span className="truncate">{t.name}</span>
                      </span>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={1} className="py-8 text-center text-[15px] text-slate-600">No tasks yet. Add one to get started.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#E6EAF0] px-4 py-3 text-sm text-slate-600">{tasks.length} task{tasks.length === 1 ? "" : "s"}</div>
        </div>
      </div>
    </div>
  );
}
