"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import EditorClient from "@/app/editor/EditorClient";
import PeopleClient from "@/app/people/PeopleClient";
import PersonDetailClient from "@/app/people/[id]/PersonDetailClient";
import SettingsClient from "@/app/settings/SettingsClient";
import TaskDetailClient from "@/app/tasks/[id]/TaskDetailClient";
import TasksClient from "@/app/tasks/TasksClient";
import RosterTable from "@/components/RosterTable";
import PageHeader from "@/components/ui/PageHeader";
import SpaLink from "@/components/ui/SpaLink";
import type { AuthUser } from "@/lib/auth";
import { formatLocalId, parseLocalId } from "@/lib/dateUtils";
import { buildEditorHref } from "@/lib/editorPersistence";
import { getDayScheduleForDate, type Person } from "@/lib/people";
import type { RosterFile } from "@/lib/rosters";
import type { GridTask, RosterEmployee } from "@/lib/rosterTypes";
import { useSpaLocation } from "@/lib/spaNavigation";
import type { TaskTemplate } from "@/lib/taskTemplates";
import {
  editorDataKey,
  isWorkspaceResourceAffected,
  loadEditorData,
  loadMonthRostersData,
  loadPeopleData,
  loadPersonData,
  loadSettingsData,
  loadTaskData,
  loadTasksData,
  loadUpcomingRostersData,
  monthRosterDataKey,
  peopleDataKey,
  personDataKey,
  preloadWorkspaceRoute,
  readCachedResource,
  refreshEditorData,
  refreshMonthRostersData,
  refreshPeopleData,
  refreshPersonData,
  refreshSettingsData,
  refreshTaskData,
  refreshTasksData,
  refreshUpcomingRostersData,
  rosterDataKey,
  settingsDataKey,
  subscribeWorkspaceResourceChanges,
  taskDataKey,
  tasksDataKey,
  type EditorPayload,
  type SettingsPayload,
  type UpcomingPayload,
} from "@/lib/workspaceData";

type ResourceState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

// The server never has the browser's cache, so the first render must show the
// loading state to match its HTML. After that, cached data can render instantly.
let hasHydrated = false;

const errorMessage = (error: unknown) => (error instanceof Error && error.message) || "Failed to load";

/** Shows cached data straight away, then refreshes it, and reloads when another view changes it. */
function useResource<T>(key: string, load: () => Promise<T>, refresh: () => Promise<T>) {
  const [state, setState] = useState<ResourceState<T>>(() => {
    const cached = readCachedResource<T>(key);
    return hasHydrated && cached.hit
      ? { status: "ready", data: cached.data, error: null }
      : { status: "loading", data: null, error: null };
  });
  const refreshRef = useRef(refresh);

  useEffect(() => {
    hasHydrated = true;
  }, []);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedResource<T>(key);
    if (cached.hit) {
      setState({ status: "ready", data: cached.data, error: null });
      refresh()
        .then((data) => {
          if (!cancelled) setState({ status: "ready", data, error: null });
        })
        .catch((error) => console.error(error));
    } else {
      setState({ status: "loading", data: null, error: null });
      load()
        .then((data) => {
          if (!cancelled) setState({ status: "ready", data, error: null });
        })
        .catch((error) => {
          if (!cancelled) setState({ status: "error", data: null, error: errorMessage(error) });
        });
    }
    return () => {
      cancelled = true;
    };
    // Loaders change identity every render; the key is what identifies the resource.
  }, [key]);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeWorkspaceResourceChanges((prefixes) => {
      if (!isWorkspaceResourceAffected(key, prefixes)) return;
      refreshRef.current()
        .then((data) => {
          if (!cancelled) setState({ status: "ready", data, error: null });
        })
        .catch((error) => {
          if (!cancelled) setState({ status: "error", data: null, error: errorMessage(error) });
        });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [key]);

  return state;
}

function LoadingState({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="mb-6 space-y-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-slate-200/80" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-slate-200/70" />
      </div>
      <div className="card overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex gap-6 border-b border-[var(--border)] px-5 py-4 last:border-b-0">
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200/70" />
            <div className="h-4 w-1/6 animate-pulse rounded bg-slate-200/60" />
            <div className="h-4 w-1/6 animate-pulse rounded bg-slate-200/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="card flex max-w-xl items-start gap-3 border-red-200 p-5" role="alert">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--danger)]" />
      <div>
        <p className="font-medium">Something went wrong loading this page</p>
        <p className="mt-1 text-[14px] text-[var(--text-muted)]">{message}</p>
        <button type="button" className="btn btn-sm mt-3" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    </div>
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={title} description={description} breadcrumb={{ label: "Rosters", href: "/rosters" }} />
    </div>
  );
}

function monthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month || "this month";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(new Date(year, monthNumber - 1, 1));
}

/** Uses the current name from People for anyone saved on the roster under an old name. */
function syncEmployeesWithPeople(employees: RosterEmployee[], people: Person[]): RosterEmployee[] {
  const byId = new Map(people.map((person) => [String(person.id), person.name]));
  const byName = new Map(people.map((person) => [person.name.toLowerCase(), person.name]));
  return employees.map((employee) => {
    const name = typeof employee?.name === "string" ? employee.name : "";
    return { ...employee, name: byId.get(String(employee?.id ?? "")) ?? byName.get(name.toLowerCase()) ?? name };
  });
}

function RostersView() {
  const state = useResource<UpcomingPayload>(rosterDataKey(), loadUpcomingRostersData, refreshUpcomingRostersData);

  if (state.status === "loading") return <LoadingState label="Loading rosters" />;
  if (state.status === "error") return <ErrorState message={state.error} />;

  const { settings, rosters } = state.data;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Rosters"
        description={`The next ${settings.upcomingDays} day${settings.upcomingDays === 1 ? "" : "s"}. Open a day to plan or edit it.`}
        actions={
          <SpaLink href={buildEditorHref(formatLocalId(new Date()))} className="btn btn-primary">
            <Plus />
            Open today
          </SpaLink>
        }
      />
      <RosterTable
        rosters={rosters}
        footer={
          <>
            Showing {settings.upcomingDays} upcoming day{settings.upcomingDays === 1 ? "" : "s"}.{" "}
            <SpaLink href="/settings" className="font-medium text-[var(--accent)] hover:underline">
              Change in Settings
            </SpaLink>
          </>
        }
      />
    </div>
  );
}

function MonthRostersView({ month }: { month: string }) {
  const state = useResource<RosterFile[]>(
    monthRosterDataKey(month),
    () => loadMonthRostersData(month),
    () => refreshMonthRostersData(month)
  );

  if (state.status === "loading") return <LoadingState label="Loading month" />;
  if (state.status === "error") return <ErrorState message={state.error} />;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={`Rosters for ${monthLabel(month)}`}
        description="Every saved day in this month."
        breadcrumb={{ label: "Rosters", href: "/rosters" }}
      />
      <RosterTable rosters={state.data} />
    </div>
  );
}

function EditorView({ dateId }: { dateId?: string }) {
  const selectedDate = useMemo(() => parseLocalId(dateId || "") ?? new Date(), [dateId]);
  const rosterDateId = useMemo(() => formatLocalId(selectedDate), [selectedDate]);
  const state = useResource<EditorPayload>(
    editorDataKey(rosterDateId),
    () => loadEditorData(rosterDateId),
    () => refreshEditorData(rosterDateId)
  );

  if (state.status === "loading") return <LoadingState label="Loading roster" />;
  if (state.status === "error") return <ErrorState message={state.error} />;

  const { people, settings, templates, savedRoster } = state.data;
  const savedEmployees = (Array.isArray(savedRoster?.employees) ? savedRoster.employees : []) as RosterEmployee[];
  const savedTasks = (Array.isArray(savedRoster?.tasks) ? savedRoster.tasks : []) as GridTask[];
  // A day nobody has touched starts with everyone who is rostered on.
  const hasSavedLayout = savedEmployees.length > 0 || savedTasks.length > 0;
  const baseEmployees = hasSavedLayout
    ? savedEmployees
    : people
        .filter((person) => getDayScheduleForDate(person, selectedDate).enabled)
        .map((person) => ({ id: person.id, name: person.name }));
  const updatedAt = savedRoster?.updatedAt as Date | string | undefined;
  const savedAt = updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt;

  return (
    <EditorClient
      key={rosterDateId}
      selectedDate={selectedDate}
      people={people}
      settings={settings}
      templates={templates}
      initialRoster={{
        employees: syncEmployeesWithPeople(baseEmployees, people),
        tasks: hasSavedLayout ? savedTasks : [],
        hoursStart: savedRoster?.hoursStart,
        hoursEnd: savedRoster?.hoursEnd,
        savedAt,
      }}
    />
  );
}

function PeopleView() {
  const state = useResource<Person[]>(peopleDataKey(), loadPeopleData, refreshPeopleData);
  if (state.status === "loading") return <LoadingState label="Loading people" />;
  if (state.status === "error") return <ErrorState message={state.error} />;
  return <PeopleClient initialPeople={state.data} />;
}

function PersonView({ id }: { id: string }) {
  const state = useResource<Person | null>(
    personDataKey(id),
    () => loadPersonData(id),
    () => refreshPersonData(id)
  );
  if (state.status === "loading") return <LoadingState label="Loading person" />;
  if (state.status === "error") return <ErrorState message={state.error} />;
  return <PersonDetailClient id={id} initialPerson={state.data} />;
}

function TasksView({ kind }: { kind: "task" | "tour" }) {
  const state = useResource<TaskTemplate[]>(tasksDataKey(), loadTasksData, refreshTasksData);
  if (state.status === "loading") return <LoadingState label={kind === "tour" ? "Loading tours" : "Loading tasks"} />;
  if (state.status === "error") return <ErrorState message={state.error} />;
  return <TasksClient initialTasks={state.data} kind={kind} />;
}

function TaskView({ id }: { id: string }) {
  const state = useResource<TaskTemplate | null>(
    taskDataKey(id),
    () => loadTaskData(id),
    () => refreshTaskData(id)
  );
  if (state.status === "loading") return <LoadingState label="Loading task" />;
  if (state.status === "error") return <ErrorState message={state.error} />;
  return <TaskDetailClient id={id} initialTask={state.data} />;
}

function SettingsView({ user }: { user: AuthUser }) {
  const state = useResource<SettingsPayload>(settingsDataKey(), loadSettingsData, refreshSettingsData);
  if (state.status === "loading") return <LoadingState label="Loading settings" />;
  if (state.status === "error") return <ErrorState message={state.error} />;
  return (
    <SettingsClient
      initialSettings={state.data.settings}
      initialSessionUser={user}
      initialMfaStatus={state.data.mfaStatus}
    />
  );
}

function NotFound() {
  return (
    <div className="card max-w-xl p-6">
      <h1 className="text-[18px] font-semibold">Page not found</h1>
      <p className="mt-1 text-[14px] text-[var(--text-muted)]">This page doesn&apos;t exist.</p>
      <SpaLink href="/rosters" className="btn mt-4">
        Back to rosters
      </SpaLink>
    </div>
  );
}

function matchPath(pathname: string, prefix: string) {
  const match = pathname.match(new RegExp(`^${prefix}/([^/]+)$`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default function WorkspaceRouter({ user }: { user: AuthUser }) {
  const { pathname, search } = useSpaLocation();
  const dateParam = useMemo(() => new URLSearchParams(search).get("date"), [search]);
  const dateId = dateParam && parseLocalId(dateParam) ? dateParam : undefined;

  useEffect(() => {
    ["/rosters", "/people", "/tasks", "/tours", "/settings", buildEditorHref(formatLocalId(new Date()))].forEach(
      preloadWorkspaceRoute
    );
  }, [user.id]);

  if (pathname === "/rosters" || pathname === "/") return <RostersView />;
  if (pathname === "/editor") return <EditorView dateId={dateId} />;
  if (pathname === "/people") return <PeopleView />;
  if (pathname === "/tasks") return <TasksView kind="task" />;
  if (pathname === "/tours") return <TasksView kind="tour" />;
  if (pathname === "/settings") return <SettingsView user={user} />;
  if (pathname === "/rosters/old") return <PlaceholderPage title="Old rosters" description="No past rosters to show yet." />;
  if (pathname === "/rosters/archive") {
    return <PlaceholderPage title="Archive" description="Archived rosters will appear here." />;
  }
  if (pathname === "/rosters/bin") return <PlaceholderPage title="Bin" description="Deleted rosters will appear here." />;

  const month = matchPath(pathname, "/rosters/months");
  if (month) return <MonthRostersView month={month} />;
  const rosterDate = matchPath(pathname, "/rosters");
  if (rosterDate) return <EditorView dateId={rosterDate} />;
  const personId = matchPath(pathname, "/people");
  if (personId) return <PersonView id={personId} />;
  const taskId = matchPath(pathname, "/tasks") ?? matchPath(pathname, "/tours");
  if (taskId) return <TaskView id={taskId} />;

  return <NotFound />;
}
