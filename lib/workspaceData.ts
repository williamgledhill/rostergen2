"use client";

import { formatLocalId } from "@/lib/dateUtils";
import type { AuthUser } from "@/lib/auth";
import type { Person } from "@/lib/people";
import type { RosterFile } from "@/lib/rosters";
import type { AppSettings } from "@/lib/settingsDefaults";
import type { TaskTemplate } from "@/lib/taskTemplates";

export type MfaStatus = {
  enabled: boolean;
  setupPending: boolean;
  setupExpiresAt: string | null;
};

export type UpcomingPayload = {
  settings: AppSettings;
  rosters: RosterFile[];
};

export type EditorPayload = {
  people: Person[];
  settings: AppSettings;
  templates: TaskTemplate[];
  savedRoster: RosterFile | null;
};

export type SettingsPayload = {
  settings: AppSettings;
  mfaStatus: MfaStatus;
};

type CacheResult<T> = { hit: true; data: T } | { hit: false; data: null };

const resourceCache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
export const WORKSPACE_RESOURCE_CHANGE_EVENT = "rosterplanner:workspace-resource-change";

export type WorkspaceResourceChangeDetail = {
  prefixes: string[];
};

function resourceKeyMatchesPrefix(key: string, prefix: string) {
  return key === prefix || key.startsWith(`${prefix}:`);
}

function dispatchWorkspaceResourceChange(prefixes: string[]) {
  if (typeof window === "undefined" || prefixes.length === 0) return;
  window.dispatchEvent(
    new CustomEvent<WorkspaceResourceChangeDetail>(WORKSPACE_RESOURCE_CHANGE_EVENT, {
      detail: { prefixes },
    })
  );
}

export function isWorkspaceResourceAffected(key: string, prefixes: string[]) {
  return prefixes.some((prefix) => resourceKeyMatchesPrefix(key, prefix));
}

export function subscribeWorkspaceResourceChanges(listener: (prefixes: string[]) => void) {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<WorkspaceResourceChangeDetail>).detail;
    if (!Array.isArray(detail?.prefixes)) return;
    listener(detail.prefixes);
  };

  window.addEventListener(WORKSPACE_RESOURCE_CHANGE_EVENT, handler);
  return () => window.removeEventListener(WORKSPACE_RESOURCE_CHANGE_EVENT, handler);
}

export function readCachedResource<T>(key: string): CacheResult<T> {
  if (!resourceCache.has(key)) return { hit: false, data: null };
  return { hit: true, data: resourceCache.get(key) as T };
}

export function writeCachedResource<T>(key: string, data: T) {
  resourceCache.set(key, data);
}

export function invalidateWorkspaceResource(keyPrefix: string) {
  invalidateWorkspaceResources([keyPrefix]);
}

export function notifyWorkspaceResourcesChanged(keyPrefixes: string[]) {
  const prefixes = Array.from(new Set(keyPrefixes.filter(Boolean)));
  dispatchWorkspaceResourceChange(prefixes);
}

export function invalidateWorkspaceResources(keyPrefixes: string[]) {
  const prefixes = Array.from(new Set(keyPrefixes.filter(Boolean)));
  if (prefixes.length === 0) return;

  for (const key of resourceCache.keys()) {
    if (prefixes.some((prefix) => resourceKeyMatchesPrefix(key, prefix))) {
      resourceCache.delete(key);
    }
  }
  dispatchWorkspaceResourceChange(prefixes);
}

export function upsertCachedPerson(person: Person) {
  writeCachedResource(personDataKey(person.id), person);

  const cachedPeople = readCachedResource<Person[]>(peopleDataKey());
  if (cachedPeople.hit) {
    const index = cachedPeople.data.findIndex((current) => current.id === person.id);
    const next =
      index >= 0
        ? cachedPeople.data.map((current) => (current.id === person.id ? person : current))
        : [...cachedPeople.data, person];
    writeCachedResource(peopleDataKey(), next);
  }

  notifyWorkspaceResourcesChanged([personDataKey(person.id), peopleDataKey()]);
  invalidateWorkspaceResources(["editor", rosterDataKey(), "rosters-month"]);
}

export function deleteCachedPerson(id: string) {
  invalidateWorkspaceResource(personDataKey(id));

  const cachedPeople = readCachedResource<Person[]>(peopleDataKey());
  if (cachedPeople.hit) {
    writeCachedResource(
      peopleDataKey(),
      cachedPeople.data.filter((person) => person.id !== id)
    );
  }

  notifyWorkspaceResourcesChanged([peopleDataKey()]);
  invalidateWorkspaceResources(["editor", rosterDataKey(), "rosters-month"]);
}

export async function loadCachedResource<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = readCachedResource<T>(key);
  if (cached.hit) return cached.data;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const request = load().then((data) => {
    writeCachedResource(key, data);
    return data;
  });
  inflight.set(key, request);
  try {
    return await request;
  } finally {
    inflight.delete(key);
  }
}

export async function refreshCachedResource<T>(key: string, load: () => Promise<T>): Promise<T> {
  const request = load().then((data) => {
    writeCachedResource(key, data);
    return data;
  });
  inflight.set(key, request);
  try {
    return await request;
  } finally {
    inflight.delete(key);
  }
}

export async function fetchJson<T>(url: string, options?: { allowNotFound?: boolean }): Promise<T | null> {
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

export function rosterDataKey() {
  return "rosters";
}

export function monthRosterDataKey(month: string) {
  return `rosters-month:${month}`;
}

export function oldRosterDataKey() {
  return "rosters-old";
}

export function editorDataKey(dateId: string) {
  return `editor:${dateId}`;
}

export function peopleDataKey() {
  return "people";
}

export function personDataKey(id: string) {
  return `person:${id}`;
}

export function tasksDataKey() {
  return "tasks";
}

export function toursDataKey() {
  return tasksDataKey();
}

export function taskDataKey(id: string) {
  return `task:${id}`;
}

export function settingsDataKey(user: Pick<AuthUser, "id">) {
  return "settings";
}

export function loadUpcomingRostersData() {
  return loadCachedResource(rosterDataKey(), () => fetchJson<UpcomingPayload>("/api/rosters/upcoming") as Promise<UpcomingPayload>);
}

export function refreshUpcomingRostersData() {
  return refreshCachedResource(rosterDataKey(), () => fetchJson<UpcomingPayload>("/api/rosters/upcoming") as Promise<UpcomingPayload>);
}

export function loadOldRostersData() {
  return loadCachedResource(oldRosterDataKey(), () => fetchJson<RosterFile[]>("/api/rosters/old") as Promise<RosterFile[]>);
}

export function refreshOldRostersData() {
  return refreshCachedResource(oldRosterDataKey(), () => fetchJson<RosterFile[]>("/api/rosters/old") as Promise<RosterFile[]>);
}

export function loadMonthRostersData(month: string) {
  return loadCachedResource(
    monthRosterDataKey(month),
    () => fetchJson<RosterFile[]>(`/api/rosters/month?month=${encodeURIComponent(month)}`) as Promise<RosterFile[]>
  );
}

export function refreshMonthRostersData(month: string) {
  return refreshCachedResource(
    monthRosterDataKey(month),
    () => fetchJson<RosterFile[]>(`/api/rosters/month?month=${encodeURIComponent(month)}`) as Promise<RosterFile[]>
  );
}

export function loadEditorData(dateId: string) {
  return loadCachedResource(editorDataKey(dateId), async () => {
    const [people, settings, templates, savedRoster] = await Promise.all([
      fetchJson<Person[]>("/api/people"),
      fetchJson<AppSettings>("/api/settings"),
      fetchJson<TaskTemplate[]>("/api/task-templates"),
      fetchJson<RosterFile>(`/api/rosters?date=${encodeURIComponent(dateId)}`, { allowNotFound: true }),
    ]);

    return {
      people: people || [],
      settings: settings as AppSettings,
      templates: templates || [],
      savedRoster,
    };
  });
}

export function refreshEditorData(dateId: string) {
  return refreshCachedResource(editorDataKey(dateId), async () => {
    const [people, settings, templates, savedRoster] = await Promise.all([
      fetchJson<Person[]>("/api/people"),
      fetchJson<AppSettings>("/api/settings"),
      fetchJson<TaskTemplate[]>("/api/task-templates"),
      fetchJson<RosterFile>(`/api/rosters?date=${encodeURIComponent(dateId)}`, { allowNotFound: true }),
    ]);

    return {
      people: people || [],
      settings: settings as AppSettings,
      templates: templates || [],
      savedRoster,
    };
  });
}

export function loadPeopleData() {
  return loadCachedResource(peopleDataKey(), () => fetchJson<Person[]>("/api/people") as Promise<Person[]>);
}

export function refreshPeopleData() {
  return refreshCachedResource(peopleDataKey(), () => fetchJson<Person[]>("/api/people") as Promise<Person[]>);
}

export function loadPersonData(id: string) {
  return loadCachedResource(
    personDataKey(id),
    () => fetchJson<Person>(`/api/people?id=${encodeURIComponent(id)}`, { allowNotFound: true }) as Promise<Person | null>
  );
}

export function refreshPersonData(id: string) {
  return refreshCachedResource(
    personDataKey(id),
    () => fetchJson<Person>(`/api/people?id=${encodeURIComponent(id)}`, { allowNotFound: true }) as Promise<Person | null>
  );
}

export function loadTasksData() {
  return loadCachedResource(tasksDataKey(), () => fetchJson<TaskTemplate[]>("/api/task-templates") as Promise<TaskTemplate[]>);
}

export function refreshTasksData() {
  return refreshCachedResource(tasksDataKey(), () => fetchJson<TaskTemplate[]>("/api/task-templates") as Promise<TaskTemplate[]>);
}

export function loadToursData() {
  return loadCachedResource(toursDataKey(), () => fetchJson<TaskTemplate[]>("/api/task-templates") as Promise<TaskTemplate[]>);
}

export function refreshToursData() {
  return refreshCachedResource(toursDataKey(), () => fetchJson<TaskTemplate[]>("/api/task-templates") as Promise<TaskTemplate[]>);
}

export function loadTaskData(id: string) {
  return loadCachedResource(
    taskDataKey(id),
    () =>
      fetchJson<TaskTemplate>(`/api/task-templates?id=${encodeURIComponent(id)}`, {
        allowNotFound: true,
      }) as Promise<TaskTemplate | null>
  );
}

export function refreshTaskData(id: string) {
  return refreshCachedResource(
    taskDataKey(id),
    () =>
      fetchJson<TaskTemplate>(`/api/task-templates?id=${encodeURIComponent(id)}`, {
        allowNotFound: true,
      }) as Promise<TaskTemplate | null>
  );
}

export function loadSettingsData(user: Pick<AuthUser, "id">) {
  return loadCachedResource(settingsDataKey(user), async () => {
    const [settings, mfaStatus] = await Promise.all([
      fetchJson<AppSettings>("/api/settings"),
      fetchJson<MfaStatus>("/api/auth/mfa"),
    ]);
    return { settings: settings as AppSettings, mfaStatus: mfaStatus as MfaStatus };
  });
}

export function refreshSettingsData(user: Pick<AuthUser, "id">) {
  return refreshCachedResource(settingsDataKey(user), async () => {
    const [settings, mfaStatus] = await Promise.all([
      fetchJson<AppSettings>("/api/settings"),
      fetchJson<MfaStatus>("/api/auth/mfa"),
    ]);
    return { settings: settings as AppSettings, mfaStatus: mfaStatus as MfaStatus };
  });
}

export function preloadWorkspaceRoute(href: string) {
  if (typeof window === "undefined") return;

  const url = new URL(href, window.location.href);
  const pathname = url.pathname;
  const safeLoad = (request: Promise<unknown>) => request.catch(() => undefined);

  if (pathname === "/rosters" || pathname === "/") {
    safeLoad(loadUpcomingRostersData());
    return;
  }
  if (pathname === "/rosters/old") {
    safeLoad(loadOldRostersData());
    return;
  }
  if (pathname === "/people") {
    safeLoad(loadPeopleData());
    return;
  }
  if (pathname === "/tasks") {
    safeLoad(loadTasksData());
    return;
  }
  if (pathname === "/tours") {
    safeLoad(loadToursData());
    return;
  }
  const tourMatch = pathname.match(/^\/tours\/([^/]+)$/);
  if (tourMatch?.[1]) {
    safeLoad(loadTaskData(decodeURIComponent(tourMatch[1])));
    return;
  }
  if (pathname === "/editor") {
    safeLoad(loadEditorData(url.searchParams.get("date") || formatLocalId(new Date())));
    return;
  }
  if (pathname === "/settings") {
    safeLoad(loadSettingsData({ id: "current" }));
    return;
  }

  const monthMatch = pathname.match(/^\/rosters\/months\/([^/]+)$/);
  if (monthMatch?.[1]) {
    safeLoad(loadMonthRostersData(decodeURIComponent(monthMatch[1])));
    return;
  }

  const rosterMatch = pathname.match(/^\/rosters\/([^/]+)$/);
  if (rosterMatch?.[1]) {
    safeLoad(loadEditorData(decodeURIComponent(rosterMatch[1])));
    return;
  }

  const personMatch = pathname.match(/^\/people\/([^/]+)$/);
  if (personMatch?.[1]) {
    safeLoad(loadPersonData(decodeURIComponent(personMatch[1])));
    return;
  }

  const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
  if (taskMatch?.[1]) {
    safeLoad(loadTaskData(decodeURIComponent(taskMatch[1])));
  }
}
