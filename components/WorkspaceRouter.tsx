"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import EditorClient from "@/app/editor/EditorClient";
import PeopleClient from "@/app/people/PeopleClient";
import PersonDetailClient from "@/app/people/[id]/PersonDetailClient";
import SettingsClient from "@/app/settings/SettingsClient";
import TaskDetailClient from "@/app/tasks/[id]/TaskDetailClient";
import TasksClient from "@/app/tasks/TasksClient";
import RosterTable from "@/components/RosterTable";
import { buildEditorHref } from "@/lib/editorPersistence";
import { formatFullDay, formatLocalId, parseLocalId } from "@/lib/dateUtils";
import { getDayScheduleForDate, type Person } from "@/lib/people";
import type { RosterFile } from "@/lib/rosters";
import type { AppSettings } from "@/lib/settingsDefaults";
import type { TaskTemplate } from "@/lib/taskTemplates";
import type { AuthUser } from "@/lib/auth";

type MfaStatus = {
  enabled: boolean;
  setupPending: boolean;
  setupExpiresAt: string | null;
};

type UpcomingPayload = {
  settings: AppSettings;
  rosters: RosterFile[];
};

type ResourceState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

function useResource<T>(key: string, load: () => Promise<T>) {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading", data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading", data: null, error: null });
    load()
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data, error: null });
      })
      .catch((error: any) => {
        if (!cancelled) setState({ status: "error", data: null, error: error?.message || "Failed to load" });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return state;
}

async function fetchJson<T>(url: string, options?: { allowNotFound?: boolean }): Promise<T | null> {
  const res = await fetch(url, { cache: "no-store" });
  if (options?.allowNotFound && res.status === 404) return null;
  if (res.status === 401) {
    window.location.href = `/signup?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Failed to load");
  }
  return (await res.json()) as T;
}

function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="w-full px-3 py-4">
      <div className="card p-4 text-sm text-slate-600">{label}</div>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="w-full px-3 py-4">
      <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
    </div>
  );
}

function EmptyPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="w-full px-3 py-3">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-slate-600">{description}</p>
      </div>
    </div>
  );
}

function monthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month || "this month";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, monthNumber - 1, 1)
  );
}

function syncEmployeesWithPeople(employees: any[], people: Person[]) {
  const byId = new Map(people.map((person) => [String(person.id), person.name]));
  const byName = new Map(people.map((person) => [person.name.toLowerCase(), person.name]));
  return employees.map((employee) => {
    const id = String(employee?.id ?? "");
    const name = typeof employee?.name === "string" ? employee.name : "";
    return {
      ...employee,
      name: byId.get(id) ?? byName.get(name.toLowerCase()) ?? name,
    };
  });
}

function workingPeopleForDate(date: Date, people: Person[]) {
  return people
    .filter((person) => getDayScheduleForDate(person, date).enabled)
    .map((person) => ({ id: person.id, name: person.name }));
}

function hasMeaningfulSavedLayout(roster: { employees?: any[]; tasks?: any[] } | null) {
  if (!roster) return false;
  const employees = Array.isArray(roster.employees) ? roster.employees : [];
  const tasks = Array.isArray(roster.tasks) ? roster.tasks : [];
  return employees.length > 0 || tasks.length > 0;
}

function RostersView() {
  const state = useResource("rosters", async () => fetchJson<UpcomingPayload>("/api/rosters/upcoming") as Promise<UpcomingPayload>);

  if (state.status === "loading") return <LoadingBlock label="Loading rosters..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;

  const { settings, rosters } = state.data;
  return (
    <div className="w-full px-3 py-3">
      <div className="flex w-full flex-col items-start space-y-3">
        <div className="flex w-full items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Upcoming Rosters</h1>
            <p className="mt-1 text-[14px] text-slate-600">
              Review the next {settings.upcomingDays} roster{settings.upcomingDays === 1 ? "" : "s"} and jump
              straight into the editor.
            </p>
          </div>
          <Link href="/rosters/old" className="btn h-9 whitespace-nowrap px-4">
            Old Rosters
          </Link>
        </div>

        <RosterTable
          rosters={rosters}
          footer={
            <>
              Autogenerates {settings.upcomingDays} roster{settings.upcomingDays === 1 ? "" : "s"}.{" "}
              <Link href="/settings" className="font-medium text-[#675dff] hover:underline">
                Click to change
              </Link>
            </>
          }
        />
      </div>
    </div>
  );
}

function MonthRostersView({ month }: { month: string }) {
  const state = useResource(
    `rosters-month-${month}`,
    async () => fetchJson<RosterFile[]>(`/api/rosters/month?month=${encodeURIComponent(month)}`) as Promise<RosterFile[]>
  );
  const todayHref = buildEditorHref(formatLocalId(new Date()));

  if (state.status === "loading") return <LoadingBlock label="Loading month..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;

  return (
    <div className="w-full px-3 py-3">
      <div className="flex w-full flex-col items-start space-y-3">
        <div className="w-full">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col leading-tight">
              <h1 className="text-2xl font-semibold">Rosters for {monthLabel(month)}</h1>
              <p className="text-[14px] text-slate-600">
                Browse individual daily rosters in this month. Today is highlighted.
              </p>
            </div>
            <Link href={todayHref} className="btn btn-primary h-9 px-3" style={{ borderRadius: "6px" }}>
              <Plus className="h-4 w-4 text-white" strokeWidth={2.3} />
              <span className="text-[14px] font-medium text-white">New Roster</span>
            </Link>
          </div>
        </div>
        <RosterTable rosters={state.data} />
      </div>
    </div>
  );
}

function EditorView({ dateId }: { dateId?: string }) {
  const selectedDate = useMemo(() => parseLocalId(dateId || "") ?? new Date(), [dateId]);
  const rosterDateId = useMemo(() => formatLocalId(selectedDate), [selectedDate]);
  const state = useResource(`editor-${rosterDateId}`, async () => {
    const [people, settings, templates, savedRoster] = await Promise.all([
      fetchJson<Person[]>("/api/people"),
      fetchJson<AppSettings>("/api/settings"),
      fetchJson<TaskTemplate[]>("/api/task-templates"),
      fetchJson<RosterFile>(`/api/rosters?date=${encodeURIComponent(rosterDateId)}`, { allowNotFound: true }),
    ]);

    return {
      people: people || [],
      settings: settings as AppSettings,
      templates: templates || [],
      savedRoster,
    };
  });

  if (state.status === "loading") return <LoadingBlock label="Loading editor..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;

  const { people, settings, templates, savedRoster } = state.data;
  const defaultEmployees = workingPeopleForDate(selectedDate, people);
  const savedEmployees = Array.isArray(savedRoster?.employees) ? savedRoster!.employees : [];
  const savedTasks = Array.isArray(savedRoster?.tasks) ? savedRoster!.tasks : [];
  const hasSavedLayout = hasMeaningfulSavedLayout(savedRoster);
  const baseEmployees = hasSavedLayout ? savedEmployees : defaultEmployees;
  const baseTasks = hasSavedLayout ? savedTasks : [];
  const savedAt =
    typeof savedRoster?.updatedAt === "string"
      ? savedRoster.updatedAt
      : savedRoster?.updatedAt instanceof Date
        ? savedRoster.updatedAt.toISOString()
        : undefined;

  return (
    <EditorClient
      key={rosterDateId}
      selectedDate={selectedDate}
      people={people}
      settings={settings}
      templates={templates}
      initialRoster={{
        employees: syncEmployeesWithPeople(baseEmployees, people),
        tasks: baseTasks,
        hoursStart: savedRoster?.hoursStart,
        hoursEnd: savedRoster?.hoursEnd,
        savedAt,
      }}
    />
  );
}

function PeopleView() {
  const state = useResource("people", async () => fetchJson<Person[]>("/api/people") as Promise<Person[]>);
  if (state.status === "loading") return <LoadingBlock label="Loading people..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;
  return <PeopleClient initialPeople={state.data} />;
}

function PersonView({ id }: { id: string }) {
  const state = useResource(
    `person-${id}`,
    async () => fetchJson<Person>(`/api/people?id=${encodeURIComponent(id)}`, { allowNotFound: true }) as Promise<Person | null>
  );
  if (state.status === "loading") return <LoadingBlock label="Loading employee..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;
  return <PersonDetailClient id={id} initialPerson={state.data} />;
}

function TasksView() {
  const state = useResource("tasks", async () => fetchJson<TaskTemplate[]>("/api/task-templates") as Promise<TaskTemplate[]>);
  if (state.status === "loading") return <LoadingBlock label="Loading tasks..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;
  return <TasksClient initialTasks={state.data} />;
}

function TaskView({ id }: { id: string }) {
  const state = useResource(
    `task-${id}`,
    async () =>
      fetchJson<TaskTemplate>(`/api/task-templates?id=${encodeURIComponent(id)}`, { allowNotFound: true }) as Promise<TaskTemplate | null>
  );
  if (state.status === "loading") return <LoadingBlock label="Loading task..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;
  return <TaskDetailClient id={id} initialTask={state.data} />;
}

function SettingsView({ user }: { user: AuthUser }) {
  const state = useResource("settings", async () => {
    const [settings, mfaStatus] = await Promise.all([
      fetchJson<AppSettings>("/api/settings"),
      fetchJson<MfaStatus>("/api/auth/mfa"),
    ]);
    return { settings: settings as AppSettings, mfaStatus: mfaStatus as MfaStatus };
  });

  if (state.status === "loading") return <LoadingBlock label="Loading settings..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;

  return (
    <SettingsClient
      initialSettings={state.data.settings}
      initialSessionUser={user}
      initialMfaStatus={state.data.mfaStatus}
    />
  );
}

function normalizeDateFromSearch(searchParams: URLSearchParams) {
  const date = searchParams.get("date");
  return date && parseLocalId(date) ? date : undefined;
}

export default function WorkspaceRouter({ user }: { user: AuthUser }) {
  const pathname = usePathname() || "/rosters";
  const searchParams = useSearchParams();
  const dateId = normalizeDateFromSearch(searchParams);

  if (pathname === "/rosters" || pathname === "/") return <RostersView />;
  if (pathname === "/editor") return <EditorView dateId={dateId} />;
  if (pathname === "/people") return <PeopleView />;
  if (pathname === "/tasks") return <TasksView />;
  if (pathname === "/settings") return <SettingsView user={user} />;
  if (pathname === "/history") return <EmptyPage title="History" description="Content coming soon." />;
  if (pathname === "/rosters/old") {
    return <EmptyPage title="Old Rosters" description="No past rosters to show yet." />;
  }
  if (pathname === "/rosters/archive") {
    return <EmptyPage title="Archive" description="Archived rosters will appear here." />;
  }
  if (pathname === "/rosters/bin") {
    return <EmptyPage title="Bin" description="Deleted rosters will appear here." />;
  }

  const monthMatch = pathname.match(/^\/rosters\/months\/([^/]+)$/);
  if (monthMatch?.[1]) return <MonthRostersView month={decodeURIComponent(monthMatch[1])} />;

  const rosterMatch = pathname.match(/^\/rosters\/([^/]+)$/);
  if (rosterMatch?.[1]) return <EditorView dateId={decodeURIComponent(rosterMatch[1])} />;

  const personMatch = pathname.match(/^\/people\/([^/]+)$/);
  if (personMatch?.[1]) return <PersonView id={decodeURIComponent(personMatch[1])} />;

  const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
  if (taskMatch?.[1]) return <TaskView id={decodeURIComponent(taskMatch[1])} />;

  return (
    <div className="w-full px-3 py-4">
      <div className="card max-w-xl p-5">
        <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">This workspace view does not exist.</p>
        <Link href="/rosters" className="btn mt-4 h-9 px-4">
          Back to rosters
        </Link>
      </div>
    </div>
  );
}
