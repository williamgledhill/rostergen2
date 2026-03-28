import { prisma } from "./prisma";
import { ensureAppPersistenceSeeded } from "./appPersistenceSeed";
import { formatFullDay, formatLocalId, parseLocalId } from "./dateUtils";

export type RosterFile = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  status: "Draft" | "Published";
  updated: string;
  tours: number;
  people: number;
  employees?: any[];
  tasks?: any[];
  hoursStart?: string;
  hoursEnd?: string;
};

function monthId(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthIdFromRosterId(id: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return null;
  return id.slice(0, 7);
}

function isEmptyRoster(r: RosterFile) {
  const employees = Array.isArray(r.employees) ? r.employees : [];
  const tasks = Array.isArray(r.tasks) ? r.tasks : [];
  return employees.length === 0 && tasks.length === 0;
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizeUpcomingWindowDays(input: number) {
  if (!Number.isFinite(input)) return 7;
  const rounded = Math.floor(input);
  if (rounded < 1) return 1;
  if (rounded > 90) return 90;
  return rounded;
}

function toLocalStartDate(value: Date | string | undefined) {
  if (!value) return null;
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function buildBlankRosterForDate(date: Date): RosterFile {
  return {
    id: formatLocalId(date),
    title: formatFullDay(date),
    start: new Date(date),
    end: new Date(date),
    status: "Draft",
    updated: "-",
    tours: 0,
    people: 0,
    employees: [],
    tasks: [],
  };
}

function normalizeRosterForDate(roster: RosterFile, date: Date): RosterFile {
  const employees = Array.isArray(roster.employees) ? roster.employees : [];
  const tasks = Array.isArray(roster.tasks) ? roster.tasks : [];
  const tours =
    typeof roster.tours === "number" && Number.isFinite(roster.tours)
      ? roster.tours
      : tasks.filter((t: any) => String(t?.type).toLowerCase() === "tour").length;
  const people =
    typeof roster.people === "number" && Number.isFinite(roster.people)
      ? roster.people
      : employees.length;
  return {
    ...roster,
    id: formatLocalId(date),
    title: roster.title || formatFullDay(date),
    start: new Date(date),
    end: new Date(date),
    status: roster.status === "Published" ? "Published" : "Draft",
    updated: typeof roster.updated === "string" && roster.updated.trim() ? roster.updated : "-",
    tours,
    people,
    employees,
    tasks,
  };
}

function mapRosterRecord(record: any): RosterFile {
  const date = toLocalStartDate(record.date) ?? parseLocalId(record.id) ?? new Date();
  return normalizeRosterForDate(
    {
      id: record.id,
      title: record.title,
      start: date,
      end: date,
      status: record.status === "Published" ? "Published" : "Draft",
      updated: record.updatedLabel || "-",
      tours: record.tours,
      people: record.people,
      employees: Array.isArray(record.employees) ? record.employees : [],
      tasks: Array.isArray(record.tasks) ? record.tasks : [],
      hoursStart: record.hoursStart || undefined,
      hoursEnd: record.hoursEnd || undefined,
    },
    date
  );
}

export async function buildRosterList(limit?: number): Promise<RosterFile[]> {
  await ensureAppPersistenceSeeded();
  const saved = (await prisma.appRoster.findMany({
    orderBy: { date: "asc" },
    ...(typeof limit === "number" ? { take: limit } : {}),
  })).map(mapRosterRecord);
  if (typeof limit === "number") return saved.slice(0, limit);
  return saved;
}

export function formatRange(start: Date, end: Date) {
  const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short" });
  const dayFmt = new Intl.DateTimeFormat("en-US", { day: "numeric" });
  const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric" });
  if (start.toDateString() === end.toDateString()) {
    return `${monthFmt.format(start)} ${dayFmt.format(start)}, ${yearFmt.format(start)}`;
  }
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${monthFmt.format(start)} ${dayFmt.format(start)} - ${dayFmt.format(end)}, ${yearFmt.format(end)}`
    : `${monthFmt.format(start)} ${dayFmt.format(start)} - ${monthFmt.format(end)} ${dayFmt.format(end)}, ${yearFmt.format(end)}`;
}

export async function getRosterById(id: string): Promise<RosterFile | null> {
  await ensureAppPersistenceSeeded();
  const roster = await prisma.appRoster.findUnique({ where: { id } });
  return roster ? mapRosterRecord(roster) : null;
}

export async function getRosterMonths(limit = 200) {
  const rosters = (await buildRosterList()).filter((r) => !isEmptyRoster(r));
  const months = new Map<string, { id: string; label: string; start: Date; rosters: RosterFile[] }>();
  rosters.forEach((r) => {
    const id = monthIdFromRosterId(r.id) ?? monthId(r.start);
    if (!months.has(id)) {
      const [yStr, mStr] = id.split("-");
      const start = new Date(Number(yStr), Number(mStr) - 1, 1);
      months.set(id, { id, label: formatMonthTitle(start), start, rosters: [] });
    }
    months.get(id)!.rosters.push(r);
  });
  const list = Array.from(months.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

export async function getRostersForMonth(month: string, limit = 200): Promise<RosterFile[]> {
  await ensureAppPersistenceSeeded();
  if (!/^\d{4}-\d{2}$/.test(month)) return [];

  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 1);

  const rosters = await prisma.appRoster.findMany({
    where: {
      date: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { date: "asc" },
    ...(typeof limit === "number" ? { take: limit } : {}),
  });

  return rosters
    .map(mapRosterRecord)
    .filter((r) => !isEmptyRoster(r))
    .slice(0, limit);
}

export function buildUpcomingRosterWindow(
  savedRosters: RosterFile[],
  upcomingDays: number,
  fromDate: Date = new Date()
): RosterFile[] {
  const dayCount = normalizeUpcomingWindowDays(upcomingDays);
  const start = startOfDay(fromDate);
  const last = new Date(start);
  last.setDate(last.getDate() + dayCount - 1);

  const byDateId = new Map<string, RosterFile>();

  savedRosters.forEach((roster) => {
    const rosterDate = parseLocalId(roster.id) ?? toLocalStartDate(roster.start);
    if (!rosterDate) return;
    if (rosterDate.getTime() < start.getTime()) return;
    if (rosterDate.getTime() > last.getTime()) return;

    const id = formatLocalId(rosterDate);
    byDateId.set(id, normalizeRosterForDate(roster, rosterDate));
  });

  const result: RosterFile[] = [];
  for (let offset = 0; offset < dayCount; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const id = formatLocalId(date);
    result.push(byDateId.get(id) ?? buildBlankRosterForDate(date));
  }

  return result;
}

export async function getUpcomingRosters(upcomingDays = 7): Promise<RosterFile[]> {
  await ensureAppPersistenceSeeded();

  const dayCount = normalizeUpcomingWindowDays(upcomingDays);
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(start.getDate() + dayCount);

  const saved = await prisma.appRoster.findMany({
    where: {
      date: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { date: "asc" },
  });

  return buildUpcomingRosterWindow(saved.map(mapRosterRecord), dayCount, start);
}

export function formatMonthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return formatMonthTitle(dt);
}

export async function saveRosterEntry(entry: RosterFile): Promise<void> {
  await ensureAppPersistenceSeeded();

  const date = parseLocalId(entry.id) ?? toLocalStartDate(entry.start) ?? new Date();
  const normalized = normalizeRosterForDate(entry, date);

  await prisma.appRoster.upsert({
    where: { id: normalized.id },
    update: {
      date,
      title: normalized.title,
      status: normalized.status,
      updatedLabel: normalized.updated,
      tours: normalized.tours,
      people: normalized.people,
      employees: Array.isArray(normalized.employees) ? normalized.employees : [],
      tasks: Array.isArray(normalized.tasks) ? normalized.tasks : [],
      hoursStart: normalized.hoursStart || null,
      hoursEnd: normalized.hoursEnd || null,
    },
    create: {
      id: normalized.id,
      date,
      title: normalized.title,
      status: normalized.status,
      updatedLabel: normalized.updated,
      tours: normalized.tours,
      people: normalized.people,
      employees: Array.isArray(normalized.employees) ? normalized.employees : [],
      tasks: Array.isArray(normalized.tasks) ? normalized.tasks : [],
      hoursStart: normalized.hoursStart || null,
      hoursEnd: normalized.hoursEnd || null,
    },
  });
}
