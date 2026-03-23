import fs from "fs";
import path from "path";
import { formatFullDay } from "./dateUtils";

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

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // shift Sunday back 6, others to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatLocalId(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseLocalId(id: string): Date | null {
  const parts = id.split("-");
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if ([y, m, d].some((n) => Number.isNaN(n))) return null;
  const dt = new Date(y, m - 1, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function deriveCounts(date: Date) {
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  const tours = (seed % 5) + 2;      // 2-6 tours
  const people = (seed % 8) + 6;     // 6-13 people
  return { tours, people };
}

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

export function buildRosterList(limit?: number): RosterFile[] {
  const saved = loadSavedRosters();
  const sorted = saved.sort((a, b) => {
    const aDate = parseLocalId(a.id) ?? a.start;
    const bDate = parseLocalId(b.id) ?? b.start;
    return aDate.getTime() - bDate.getTime();
  });
  if (typeof limit === "number") return sorted.slice(0, limit);
  return sorted;
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

export function getRosterById(id: string): RosterFile | null {
  const target = parseLocalId(id);
  if (!target) return null;
  const key = formatLocalId(target);
  return loadSavedRosters().find((r) => r.id === key) || null;
}

export function getRosterMonths(limit = 200) {
  const rosters = loadSavedRosters().filter((r) => !isEmptyRoster(r));
  const sorted = rosters.sort((a, b) => {
    const aDate = parseLocalId(a.id) ?? a.start;
    const bDate = parseLocalId(b.id) ?? b.start;
    return aDate.getTime() - bDate.getTime();
  });
  const months = new Map<string, { id: string; label: string; start: Date; rosters: RosterFile[] }>();
  sorted.forEach((r) => {
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

export function getRostersForMonth(month: string, limit = 200): RosterFile[] {
  if (!/^\d{4}-\d{2}$/.test(month)) return [];
  const rosters = loadSavedRosters();
  const filtered = rosters
    .filter((r) => (monthIdFromRosterId(r.id) ?? monthId(r.start)) === month)
    .filter((r) => !isEmptyRoster(r))
    .sort((a, b) => {
      const aDate = parseLocalId(a.id) ?? a.start;
      const bDate = parseLocalId(b.id) ?? b.start;
      return aDate.getTime() - bDate.getTime();
    });
  return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
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

export function getUpcomingRosters(upcomingDays = 7): RosterFile[] {
  return buildUpcomingRosterWindow(loadSavedRosters(), upcomingDays, new Date());
}

export function formatMonthLabel(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return formatMonthTitle(dt);
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "rosters.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf-8");
}

export function loadSavedRosters(): RosterFile[] {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw) as RosterFile[];
    return parsed.map((r) => ({
      ...r,
      start: parseLocalId(r.id) ?? new Date(r.start),
      end: parseLocalId(r.id) ?? new Date(r.end),
    }));
  } catch {
    return [];
  }
}

export function saveRosters(rosters: RosterFile[]) {
  ensureDataFile();
  const serializable = rosters.map((r) => ({
    ...r,
    start: r.start instanceof Date ? r.start.toISOString() : r.start,
    end: r.end instanceof Date ? r.end.toISOString() : r.end,
  }));
  fs.writeFileSync(DATA_FILE, JSON.stringify(serializable, null, 2), "utf-8");
}

export function saveRosterEntry(entry: RosterFile) {
  const rosters = loadSavedRosters();
  const idx = rosters.findIndex((r) => r.id === entry.id);
  if (idx >= 0) rosters[idx] = entry;
  else rosters.push(entry);
  saveRosters(rosters);
}
