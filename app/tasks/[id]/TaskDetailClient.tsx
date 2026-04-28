"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Save, Trash2 } from "lucide-react";
import {
  buildDraftStorageKey,
  formatAutosaveStatusText,
  getAutosaveStatusClassName,
  removeDraftRecord,
} from "@/lib/clientDrafts";
import { navigateWithinSpa, shouldHandleSpaClick } from "@/lib/spaNavigation";
import { invalidateWorkspaceResource, taskDataKey, writeCachedResource } from "@/lib/workspaceData";
import {
  TASK_TEMPLATE_DELETED_STORAGE_KEY,
  TASK_TEMPLATE_REFRESH_EVENT,
  TASK_TEMPLATE_REFRESH_STORAGE_KEY,
  type TaskTemplate,
} from "@/lib/taskTemplates";
import { usePersistedAutosave } from "@/lib/usePersistedAutosave";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-2.5">
        <h2 className="text-[18px] font-bold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] font-medium text-slate-600">{description}</p> : null}
      </div>
      <div className="p-3.5 sm:p-4">{children}</div>
    </section>
  );
}

function FieldBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[14px] font-semibold text-slate-900">{label}</label>
      {children}
    </div>
  );
}

export default function TaskDetailClient({ id, initialTask }: { id: string; initialTask: TaskTemplate | null }) {
  const router = useRouter();
  const initialTaskValue = useMemo(() => initialTask, [initialTask]);
  const {
    value: task,
    setValue: setTask,
    saveState,
    saveNow,
  } = usePersistedAutosave<TaskTemplate | null>({
    storageKey: buildDraftStorageKey("task", id),
    initialValue: initialTaskValue,
    getSignature: (value) => JSON.stringify(value),
    save: async (value, { keepalive, mode }) => {
      if (!value) return;
      const res = await fetch("/api/task-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
        keepalive,
      });
      if (!res.ok) throw new Error("Failed to save");
      const saved = (await res.json()) as TaskTemplate;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TASK_TEMPLATE_REFRESH_EVENT));
        try {
          window.localStorage.setItem(TASK_TEMPLATE_REFRESH_STORAGE_KEY, new Date().toISOString());
        } catch (error) {
          console.error(error);
        }
      }
      if (mode === "manual") {
        router.refresh();
      }
      writeCachedResource(taskDataKey(id), saved);
      invalidateWorkspaceResource("tasks");
      return {
        value: saved,
        savedAt: new Date().toISOString(),
      };
    },
  });

  async function removeTask() {
    if (!confirm("Delete this task? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/task-templates?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      removeDraftRecord(buildDraftStorageKey("task", id));
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(TASK_TEMPLATE_REFRESH_EVENT));
        try {
          window.sessionStorage.setItem(TASK_TEMPLATE_DELETED_STORAGE_KEY, id);
          window.localStorage.setItem(TASK_TEMPLATE_REFRESH_STORAGE_KEY, new Date().toISOString());
        } catch (error) {
          console.error(error);
        }
      }
      invalidateWorkspaceResource("tasks");
      invalidateWorkspaceResource(taskDataKey(id));
      if (!navigateWithinSpa("/tasks")) router.push("/tasks");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Failed to delete");
    }
  }

  if (!task) {
    return (
      <div className="w-full px-3 py-4">
        <div className="card max-w-xl p-5">
          <h1 className="text-xl font-semibold text-slate-900">Task not found</h1>
          <p className="mt-2 text-sm text-slate-600">That task template does not exist.</p>
          <div className="mt-4">
            <Link
              href="/tasks"
              className="btn h-9 px-4"
              onClick={(event) => {
                if (shouldHandleSpaClick(event) && navigateWithinSpa("/tasks")) {
                  event.preventDefault();
                }
              }}
            >
              Back to tasks
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const saveStatusText = formatAutosaveStatusText(saveState);
  const saveStatusClassName = getAutosaveStatusClassName(saveState);

  return (
    <div className="w-full px-3 py-4">
      <div className="flex w-full max-w-[760px] flex-col gap-3">
        <div className="flex items-center gap-1 text-[14px]">
          <Link
            href="/tasks"
            className="font-semibold text-[#675dff] hover:underline"
            onClick={(event) => {
              if (shouldHandleSpaClick(event) && navigateWithinSpa("/tasks")) {
                event.preventDefault();
              }
            }}
          >
            Tasks
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-700" />
          <span className="font-medium text-slate-600">{task.name || "Task"}</span>
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <h1 className="break-words text-[clamp(1.5rem,4vw,2.05rem)] font-bold leading-tight text-slate-900">
              {task.name || "Task"}
            </h1>
            <p className="text-[15px] font-medium text-slate-600">Basic task details.</p>
            <p className={`text-[12px] font-medium ${saveStatusClassName}`}>{saveStatusText}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-[34px] items-center justify-center gap-2 rounded-[var(--radius-md)] border border-red-300 bg-white px-3 text-[13px] font-medium text-red-700 transition hover:bg-red-600 hover:text-white"
              onClick={removeTask}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void saveNow({ mode: "manual" })}
              disabled={saveState.state === "saving"}
            >
              <Save className="h-4 w-4" />
              {saveState.state === "saving" ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <SectionCard
          title="Task details"
          description="Only the task name and colour are editable here now."
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <FieldBlock label="Name">
              <input
                className="input h-10 w-full text-[14px]"
                value={task.name}
                onChange={(event) => setTask((current) => (current ? { ...current, name: event.target.value } : current))}
              />
            </FieldBlock>

            <FieldBlock label="Colour">
              <input
                type="color"
                className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white p-1"
                value={task.color || "#ffffff"}
                onChange={(event) => setTask((current) => (current ? { ...current, color: event.target.value } : current))}
              />
            </FieldBlock>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
