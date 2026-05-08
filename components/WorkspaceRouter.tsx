"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Plus, Sparkles } from "lucide-react";
import EditorClient from "@/app/editor/EditorClient";
import PeopleClient from "@/app/people/PeopleClient";
import PersonDetailClient from "@/app/people/[id]/PersonDetailClient";
import SettingsClient from "@/app/settings/SettingsClient";
import TaskDetailClient from "@/app/tasks/[id]/TaskDetailClient";
import TasksClient from "@/app/tasks/TasksClient";
import RosterTable from "@/components/RosterTable";
import { buildEditorHref } from "@/lib/editorPersistence";
import { formatLocalId, parseLocalId } from "@/lib/dateUtils";
import { getDayScheduleForDate, type Person } from "@/lib/people";
import type { RosterFile } from "@/lib/rosters";
import type { AuthUser } from "@/lib/auth";
import { navigateWithinSpa, shouldHandleSpaClick, useSpaLocation } from "@/lib/spaNavigation";
import {
  editorDataKey,
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
  isWorkspaceResourceAffected,
  subscribeWorkspaceResourceChanges,
  taskDataKey,
  tasksDataKey,
  type EditorPayload,
  type SettingsPayload,
  type UpcomingPayload,
} from "@/lib/workspaceData";
import type { TaskTemplate } from "@/lib/taskTemplates";

type ResourceState<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

function useResource<T>(key: string, load: () => Promise<T>, refresh: () => Promise<T>) {
  const cached = readCachedResource<T>(key);
  const [state, setState] = useState<ResourceState<T>>(
    cached.hit ? { status: "ready", data: cached.data, error: null } : { status: "loading", data: null, error: null }
  );
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    const current = readCachedResource<T>(key);
    if (current.hit) {
      setState({ status: "ready", data: current.data, error: null });
      refresh()
        .then((data) => {
          if (!cancelled) setState({ status: "ready", data, error: null });
        })
        .catch((error) => {
          console.error(error);
        });
      return () => {
        cancelled = true;
      };
    }

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

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = subscribeWorkspaceResourceChanges((prefixes) => {
      if (!isWorkspaceResourceAffected(key, prefixes)) return;
      refreshRef.current()
        .then((data) => {
          if (!cancelled) setState({ status: "ready", data, error: null });
        })
        .catch((error: any) => {
          if (!cancelled) {
            setState({ status: "error", data: null, error: error?.message || "Failed to load" });
          }
        });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [key]);

  return state;
}

function LoadingBlock({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="workspace-page">
      <div className="card p-5 text-sm text-[var(--muted)]">{label}</div>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="workspace-page">
      <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
    </div>
  );
}

function SpaLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onMouseEnter={() => preloadWorkspaceRoute(href)}
      onFocus={() => preloadWorkspaceRoute(href)}
      onClick={(event) => {
        if (shouldHandleSpaClick(event) && navigateWithinSpa(href)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </Link>
  );
}

function EmptyPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="workspace-page">
      <div className="space-y-7">
        <h1 className="page-title">{title}</h1>
        <div className="surface-panel max-w-3xl px-5 py-5">
          <p className="page-description">{description}</p>
        </div>
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
  const state = useResource<UpcomingPayload>(rosterDataKey(), loadUpcomingRostersData, refreshUpcomingRostersData);

  if (state.status === "loading") return <LoadingBlock label="Loading rosters..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;

  const { settings, rosters } = state.data;
  return (
    <div className="workspace-page">
      <div className="flex w-full flex-col items-start space-y-7">
        <div className="flex w-full items-start justify-between gap-3">
          <div>
            <h1 className="page-title">Upcoming Rosters</h1>
            <p className="page-description mt-1.5">
              Review the next {settings.upcomingDays} roster{settings.upcomingDays === 1 ? "" : "s"} and jump
              straight into the editor.
            </p>
          </div>
        </div>

        <div className="inline-flex overflow-hidden rounded-[8px] border border-[var(--border)] bg-white">
          <SpaLink
            href="/rosters"
            className="inline-flex h-11 min-w-[190px] items-center justify-center bg-[var(--accent)] px-5 text-[15px] font-bold text-white"
          >
            Current Rosters
          </SpaLink>
          <SpaLink
            href="/rosters/old"
            className="inline-flex h-11 min-w-[165px] items-center justify-center px-5 text-[15px] font-semibold text-[var(--muted-strong)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--accent)]"
          >
            Old Rosters
          </SpaLink>
        </div>

        <RosterTable rosters={rosters} />

        <div className="soft-callout flex w-full items-center gap-5 px-5 py-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-[var(--accent)] text-white">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 text-[15px] font-medium text-[var(--accent)]">
            <p>
              Autogenerate {settings.upcomingDays} roster{settings.upcomingDays === 1 ? "" : "s"} based on your tours, staff and rules.
            </p>
            <SpaLink href="/settings" className="mt-1 inline-flex items-center gap-2 font-bold text-[var(--accent)] underline underline-offset-3">
              Learn more
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </SpaLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthRostersView({ month }: { month: string }) {
  const state = useResource<RosterFile[]>(
    monthRosterDataKey(month),
    () => loadMonthRostersData(month),
    () => refreshMonthRostersData(month)
  );
  const todayHref = buildEditorHref(formatLocalId(new Date()));

  if (state.status === "loading") return <LoadingBlock label="Loading month..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;

  return (
    <div className="workspace-page">
      <div className="flex w-full flex-col items-start space-y-7">
        <div className="w-full">
          <div className="flex w-full items-center justify-between">
            <div className="flex flex-col leading-tight">
              <h1 className="page-title">Rosters for {monthLabel(month)}</h1>
              <p className="page-description mt-1.5">
                Browse individual daily rosters in this month. Today is highlighted.
              </p>
            </div>
            <SpaLink href={todayHref} className="btn btn-primary px-4">
              <Plus className="h-4 w-4 text-white" strokeWidth={2.3} />
              <span className="text-[14px] font-medium text-white">New Roster</span>
            </SpaLink>
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
  const state = useResource<EditorPayload>(
    editorDataKey(rosterDateId),
    () => loadEditorData(rosterDateId),
    () => refreshEditorData(rosterDateId)
  );

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
  const state = useResource<Person[]>(peopleDataKey(), loadPeopleData, refreshPeopleData);
  if (state.status === "loading") return <LoadingBlock label="Loading people..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;
  return <PeopleClient initialPeople={state.data} />;
}

function PersonView({ id }: { id: string }) {
  const state = useResource<Person | null>(
    personDataKey(id),
    () => loadPersonData(id),
    () => refreshPersonData(id)
  );
  if (state.status === "loading") return <LoadingBlock label="Loading employee..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;
  return <PersonDetailClient id={id} initialPerson={state.data} />;
}

function TasksView() {
  const state = useResource<TaskTemplate[]>(tasksDataKey(), loadTasksData, refreshTasksData);
  if (state.status === "loading") return <LoadingBlock label="Loading tasks..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;
  return <TasksClient initialTasks={state.data} />;
}

function TaskView({ id }: { id: string }) {
  const state = useResource<TaskTemplate | null>(
    taskDataKey(id),
    () => loadTaskData(id),
    () => refreshTaskData(id)
  );
  if (state.status === "loading") return <LoadingBlock label="Loading task..." />;
  if (state.status === "error") return <ErrorBlock message={state.error} />;
  return <TaskDetailClient id={id} initialTask={state.data} />;
}

function SettingsView({ user }: { user: AuthUser }) {
  const state = useResource<SettingsPayload>(
    settingsDataKey(user),
    () => loadSettingsData(user),
    () => refreshSettingsData(user)
  );

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
  const { pathname, search } = useSpaLocation();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const dateId = normalizeDateFromSearch(searchParams);

  useEffect(() => {
    ["/rosters", "/people", "/tasks", "/settings", buildEditorHref(formatLocalId(new Date()))].forEach((href) => {
      preloadWorkspaceRoute(href);
    });
  }, [user.id]);

  if (pathname === "/rosters" || pathname === "/") return <RostersView />;
  if (pathname === "/editor") return <EditorView dateId={dateId} />;
  if (pathname === "/tours") return <EmptyPage title="Tours" description="Tour management will appear here." />;
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
    <div className="workspace-page">
      <div className="surface-panel max-w-xl p-5">
        <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">This workspace view does not exist.</p>
        <SpaLink href="/rosters" className="btn mt-4 h-9 px-4">
          Back to rosters
        </SpaLink>
      </div>
    </div>
  );
}
