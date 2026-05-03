"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { navigateWithinSpa } from "@/lib/spaNavigation";
import {
  invalidateWorkspaceResource,
  notifyWorkspaceResourcesChanged,
  preloadWorkspaceRoute,
  taskDataKey,
  tasksDataKey,
  writeCachedResource,
} from "@/lib/workspaceData";
import {
  TASK_TEMPLATE_DELETED_STORAGE_KEY,
  TASK_TEMPLATE_REFRESH_EVENT,
  TASK_TEMPLATE_REFRESH_STORAGE_KEY,
  type TaskTemplate,
} from "@/lib/taskTemplates";

const DEFAULT_TASK_COLOR = "#BFDBFE";

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export default function TasksClient({ initialTasks }: { initialTasks: TaskTemplate[] }) {
  const [tasks, setTasks] = useState<TaskTemplate[]>(initialTasks);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskColor, setNewTaskColor] = useState(DEFAULT_TASK_COLOR);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
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

  function openTaskCreator() {
    setNewTaskName("");
    setNewTaskColor(DEFAULT_TASK_COLOR);
    setCreateError("");
    setModalOpen(true);
  }

  function closeTaskCreator() {
    if (isCreating) return;
    setModalOpen(false);
    setCreateError("");
  }

  async function createTask(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = newTaskName.trim();
    if (!trimmed) return;
    const trimmedColor = newTaskColor.trim();

    try {
      setIsCreating(true);
      setCreateError("");
      const res = await fetch("/api/task-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color: trimmedColor }),
      });
      if (!res.ok) throw new Error("Failed to add template");
      const created = (await res.json()) as TaskTemplate;
      setTasks((prev) => {
        const next = [...prev, created];
        writeCachedResource(tasksDataKey(), next);
        return next;
      });
      writeCachedResource(taskDataKey(created.id), created);
      notifyWorkspaceResourcesChanged([tasksDataKey(), taskDataKey(created.id)]);
      invalidateWorkspaceResource("editor");
      window.dispatchEvent(new Event(TASK_TEMPLATE_REFRESH_EVENT));
      try {
        window.localStorage.setItem(TASK_TEMPLATE_REFRESH_STORAGE_KEY, new Date().toISOString());
      } catch (error) {
        console.error(error);
      }
      const href = `/tasks/${created.id}`;
      if (!navigateWithinSpa(href)) router.push(href);
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      setCreateError("Failed to add task template.");
    } finally {
      setIsCreating(false);
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
          <button className="btn btn-primary px-4 py-2" style={{ borderRadius: "6px" }} onClick={openTaskCreator}>
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

        {modalOpen && (
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 px-4" onClick={closeTaskCreator}>
            <form
              className="w-full max-w-xl overflow-hidden rounded-[8px] border border-[var(--border)] bg-white shadow-xl"
              onClick={(event) => event.stopPropagation()}
              onSubmit={createTask}
            >
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold">Add task</h2>
                  <p className="text-sm text-slate-600">Create a reusable task template.</p>
                </div>
                <button
                  type="button"
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-[#f5f7fa] hover:text-slate-700"
                  onClick={closeTaskCreator}
                  aria-label="Close"
                  disabled={isCreating}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 px-6 pb-5 text-[14px]" style={{ color: "#1A1B25" }}>
                <div>
                  <label className="mb-1 block text-sm font-semibold" htmlFor="new-task-name" style={{ color: "#1A1B25" }}>
                    Name
                  </label>
                  <input
                    id="new-task-name"
                    className="input w-full text-[14px]"
                    style={{ color: "#1A1B25" }}
                    value={newTaskName}
                    onChange={(event) => setNewTaskName(event.target.value)}
                    autoFocus
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold" htmlFor="new-task-color" style={{ color: "#1A1B25" }}>
                    Colour
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={isHexColor(newTaskColor) ? newTaskColor : DEFAULT_TASK_COLOR}
                      onChange={(event) => setNewTaskColor(event.target.value)}
                      aria-label="Pick task colour"
                      className="h-10 w-12 cursor-pointer rounded-md border border-[var(--border)] bg-white p-1"
                    />
                    <input
                      id="new-task-color"
                      className="input min-w-0 flex-1 text-[14px]"
                      style={{ color: "#1A1B25" }}
                      value={newTaskColor}
                      onChange={(event) => setNewTaskColor(event.target.value)}
                      placeholder="#BFDBFE"
                    />
                    <span
                      className="h-8 w-8 shrink-0 rounded-full border border-slate-300"
                      style={{ backgroundColor: newTaskColor || "#fff" }}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                {createError && <p className="text-sm text-red-600">{createError}</p>}
              </div>

              <div className="flex items-center justify-end gap-3 bg-white px-6 py-4">
                <button
                  type="button"
                  className="btn h-[30px] justify-center text-black/80 hover:text-black"
                  style={{ width: "65px", boxShadow: "inset 0 0 0 1px #CFCFCF", borderRadius: "6px", border: "none", background: "white" }}
                  onClick={closeTaskCreator}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button className="btn btn-primary h-[30px] px-4" style={{ borderRadius: "6px" }} type="submit" disabled={isCreating || !newTaskName.trim()}>
                  {isCreating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
