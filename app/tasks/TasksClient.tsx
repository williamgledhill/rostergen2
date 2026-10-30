"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import PageHeader from "@/components/ui/PageHeader";
import { DAY_KEYS } from "@/lib/settingsDefaults";
import { navigateWithinSpa } from "@/lib/spaNavigation";
import {
  TASK_TEMPLATE_DELETED_STORAGE_KEY,
  TASK_TEMPLATE_REFRESH_EVENT,
  TASK_TEMPLATE_REFRESH_STORAGE_KEY,
  TOUR_CATEGORY,
  TOUR_WAITING_MINUTES,
  isFloorTemplate,
  isTourTemplate,
  type TaskTemplate,
} from "@/lib/taskTemplates";
import {
  invalidateWorkspaceResource,
  notifyWorkspaceResourcesChanged,
  preloadWorkspaceRoute,
  taskDataKey,
  tasksDataKey,
  writeCachedResource,
} from "@/lib/workspaceData";

const DEFAULT_TASK_COLOR = "#BFDBFE";

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function describeDays(days: string[] = []) {
  if (days.length === 7) return "Every day";
  if (days.length === 5 && DAY_KEYS.slice(0, 5).every((day) => days.includes(day))) return "Weekdays";
  if (days.length === 2 && days.includes("Sat") && days.includes("Sun")) return "Weekends";
  return DAY_KEYS.filter((day) => days.includes(day)).join(", ");
}

/** A few words on the rules that matter most when scanning the list. */
function describeTask(task: TaskTemplate, nameById: Map<string, string>) {
  const parts: string[] = [];
  const pairedName = task.pairedWithTaskId ? nameById.get(task.pairedWithTaskId) : undefined;
  if (pairedName) parts.push(`${task.pairedPosition === "before" ? "Before" : "After"} ${pairedName}`);
  if (task.attendedByAll) parts.push("Everyone attends");
  else if (task.mustManned) parts.push("Must be manned");
  if ((task.durationMinutes ?? 0) > 0) parts.push(`${task.durationMinutes} min`);
  const timeCount =
    (task.regularTimes?.length ?? 0) +
    Object.values(task.regularTimesByDay ?? {}).reduce((sum, times) => sum + (times?.length ?? 0), 0);
  if (timeCount > 0) parts.push("Set times");
  if ((task.minPerEmployeePerDay ?? 0) > 0) parts.push(`${task.minPerEmployeePerDay}× per person`);
  if (isFloorTemplate(task)) {
    parts.push("Floor task");
    if ((task.maxConcurrentPerTimeslot ?? 0) > 0) parts.push(`max ${task.maxConcurrentPerTimeslot} at once`);
    parts.push(`${(task.maxConsecutiveMinutes ?? 0) > 0 ? task.maxConsecutiveMinutes : 60} min in one go`);
  }
  const days = describeDays(task.regularDays);
  if (days) parts.push(days);
  return parts;
}

function TaskTable({
  tasks,
  nameById,
  noun,
  emptyText,
  onOpen,
}: {
  tasks: TaskTemplate[];
  nameById: Map<string, string>;
  noun: "task" | "tour";
  emptyText: string;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="hidden sm:table-cell">Rules</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className="is-clickable"
                onMouseEnter={() => preloadWorkspaceRoute(taskHref(task))}
                onClick={() => onOpen(task.id)}
              >
                <td className="w-[40%]">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-4 w-4 shrink-0 rounded-[5px] ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: task.color || "#fff" }}
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpen(task.id);
                      }}
                    >
                      {task.name}
                    </button>
                    {task.enabled === false && <span className="badge">Off</span>}
                  </div>
                </td>
                <td className="hidden text-[13px] text-[var(--text-muted)] sm:table-cell">
                  {describeTask(task, nameById).join(" · ") || "—"}
                </td>
                <td className="w-10 text-[var(--text-faint)]">
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-[var(--text-muted)]">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--border)] px-5 py-3 text-[13px] text-[var(--text-muted)]">
        {tasks.length} {noun}
        {tasks.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/** Link to a task's or tour's own page. */
export function taskHref(task: Pick<TaskTemplate, "id" | "category">) {
  return `${isTourTemplate(task) ? "/tours" : "/tasks"}/${task.id}`;
}

/** The Tasks page, or with kind "tour" the Tours page. */
export default function TasksClient({
  initialTasks,
  kind = "task",
}: {
  initialTasks: TaskTemplate[];
  kind?: "task" | "tour";
}) {
  const isTourPage = kind === "tour";
  const [tasks, setTasks] = useState<TaskTemplate[]>(initialTasks);
  const [dialogKind, setDialogKind] = useState<"task" | "tour" | null>(null);

  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskColor, setNewTaskColor] = useState(DEFAULT_TASK_COLOR);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const removePendingDeletedTask = useCallback(() => {
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

  const openTask = (id: string) => {
    const href = `${isTourPage ? "/tours" : "/tasks"}/${id}`;
    if (!navigateWithinSpa(href)) router.push(href);
  };

  function openCreator(kind: "task" | "tour") {
    setNewTaskName("");
    setNewTaskColor(DEFAULT_TASK_COLOR);
    setCreateError("");
    setDialogKind(kind);
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newTaskName.trim();
    if (!name) return;

    try {
      setIsCreating(true);
      setCreateError("");
      const res = await fetch("/api/task-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          color: newTaskColor.trim(),
          ...(dialogKind === "tour" ? { category: TOUR_CATEGORY } : {}),
        }),
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
      setDialogKind(null);
      openTask(created.id);
    } catch (err) {
      console.error(err);
      setCreateError("Couldn't add the task. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={isTourPage ? "Tours" : "Tasks"}
        description={
          isTourPage
            ? `Tours run at set times. Every tour starts with a ${TOUR_WAITING_MINUTES}-minute “Waiting for” block.`
            : "The jobs that go on a roster, and the rules autofill follows for each."
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={() => openCreator(kind)}>
            <Plus />
            {isTourPage ? "Add tour" : "Add task"}
          </button>
        }
      />

      <TaskTable
        tasks={tasks.filter((task) => isTourTemplate(task) === isTourPage)}
        nameById={new Map(tasks.map((task) => [task.id, task.name]))}
        noun={kind}
        emptyText={isTourPage ? "No tours yet." : "No tasks yet."}
        onOpen={openTask}
      />

      <Dialog
        open={dialogKind !== null}
        onClose={() => !isCreating && setDialogKind(null)}
        size="sm"
        title={dialogKind === "tour" ? "Add tour" : "Add task"}
        description="You can set when it happens and how autofill uses it next."
        as="form"
        onSubmit={createTask}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setDialogKind(null)} disabled={isCreating}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isCreating || !newTaskName.trim()}>
              {isCreating ? "Adding…" : dialogKind === "tour" ? "Add tour" : "Add task"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="new-task-name">
              Name
            </label>
            <input
              id="new-task-name"
              className="input w-full"
              value={newTaskName}
              onChange={(event) => setNewTaskName(event.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="field-label" htmlFor="new-task-color">
              Colour
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={isHexColor(newTaskColor) ? newTaskColor : DEFAULT_TASK_COLOR}
                onChange={(event) => setNewTaskColor(event.target.value)}
                aria-label="Pick task colour"
                className="h-9 w-11 cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-white p-1"
              />
              <input
                id="new-task-color"
                className="input min-w-0 flex-1 font-mono text-[13px]"
                value={newTaskColor}
                onChange={(event) => setNewTaskColor(event.target.value)}
                placeholder="#BFDBFE"
              />
            </div>
          </div>
          {createError && <p className="text-[13px] text-[var(--danger)]">{createError}</p>}
        </div>
      </Dialog>
    </div>
  );
}
