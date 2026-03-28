export type DaySchedule = { enabled: boolean; start: string; end: string };
export const ALL_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] as const;
export type DayKey = typeof ALL_DAYS[number];
export type WeeklySchedule = Record<DayKey, DaySchedule>;
export type FortnightWeekKey = "weekA" | "weekB";
export type FortnightSchedule = {
  anchorDate: string;
  weekA: WeeklySchedule;
  weekB: WeeklySchedule;
};
export type Person = {
  id: string;
  name: string;
  email?: string;
  schedule: WeeklySchedule;
  fortnight?: FortnightSchedule;
};

const DEFAULT_START = "09:00";
const DEFAULT_END = "17:00";
const DEFAULT_ANCHOR_DATE = "2026-01-05";
const DATE_TO_DAY: DayKey[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function defaultSchedule(days: string[]): WeeklySchedule {
  const schedule = {} as WeeklySchedule;
  ALL_DAYS.forEach((day) => {
    schedule[day] = {
      enabled: days.includes(day),
      start: DEFAULT_START,
      end: DEFAULT_END,
    };
  });
  return schedule;
}

function normalizeSchedule(input?: Partial<Record<string, Partial<DaySchedule>>> | null): WeeklySchedule {
  const schedule = {} as WeeklySchedule;
  ALL_DAYS.forEach((day) => {
    const raw = input?.[day];
    schedule[day] = {
      enabled: !!raw?.enabled,
      start: typeof raw?.start === "string" ? raw.start : DEFAULT_START,
      end: typeof raw?.end === "string" ? raw.end : DEFAULT_END,
    };
  });
  return schedule;
}

function parseDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function defaultFortnightSchedule(daysWeekA: string[] = [], daysWeekB: string[] = daysWeekA): FortnightSchedule {
  return {
    anchorDate: DEFAULT_ANCHOR_DATE,
    weekA: defaultSchedule(daysWeekA),
    weekB: defaultSchedule(daysWeekB),
  };
}

export function ensureFortnightSchedule(person: Pick<Person, "schedule" | "fortnight">): FortnightSchedule {
  const fallbackWeek = normalizeSchedule(person.schedule);
  const anchor =
    typeof person.fortnight?.anchorDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(person.fortnight.anchorDate)
      ? person.fortnight.anchorDate
      : DEFAULT_ANCHOR_DATE;
  return {
    anchorDate: anchor,
    weekA: normalizeSchedule(person.fortnight?.weekA ?? fallbackWeek),
    weekB: normalizeSchedule(person.fortnight?.weekB ?? fallbackWeek),
  };
}

export function getFortnightWeekKey(date: Date, anchorDate?: string): FortnightWeekKey {
  const anchor = parseDate(anchorDate) ?? parseDate(DEFAULT_ANCHOR_DATE)!;
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffMs = target.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const parity = ((diffWeeks % 2) + 2) % 2;
  return parity === 0 ? "weekA" : "weekB";
}

export function getDayScheduleForDate(person: Pick<Person, "schedule" | "fortnight">, date: Date): DaySchedule {
  const day = DATE_TO_DAY[date.getDay()];
  const fortnight = ensureFortnightSchedule(person);
  const weekKey = getFortnightWeekKey(date, fortnight.anchorDate);
  return fortnight[weekKey][day];
}

export const seedPeople: Person[] = [
  {
    id: "1",
    name: "John",
    email: "john@example.com",
    schedule: defaultSchedule(["Mon","Tue","Wed","Thu","Fri"]),
    fortnight: defaultFortnightSchedule(["Mon","Tue","Wed","Thu","Fri"]),
  },
  {
    id: "2",
    name: "Robert",
    email: "robert@example.com",
    schedule: defaultSchedule(["Mon","Wed","Fri"]),
    fortnight: defaultFortnightSchedule(["Mon","Wed","Fri"]),
  },
  {
    id: "3",
    name: "Mary",
    email: "mary@example.com",
    schedule: defaultSchedule(["Tue","Thu","Sat"]),
    fortnight: defaultFortnightSchedule(["Tue","Thu","Sat"]),
  },
];

const isServer = typeof window === "undefined";
let serverStore: any = null;
if (isServer) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    serverStore = require("./peopleStore");
  } catch {
    serverStore = null;
  }
}

export const getPeople = isServer
  ? ((serverStore?.getPeople as (() => Person[]) | undefined) ?? (() => seedPeople))
  : () => seedPeople;

export const getPerson = isServer
  ? ((serverStore?.getPerson as ((id: string) => Person | null) | undefined) ?? ((id: string) => seedPeople.find(p => p.id === id) ?? null))
  : (id: string) => seedPeople.find(p => p.id === id) ?? null;

export const upsertPerson = isServer
  ? ((serverStore?.upsertPerson as ((p: Person) => Person) | undefined) ?? ((p: Person) => p))
  : (p: Person) => p;

export const deletePerson = isServer
  ? ((serverStore?.deletePerson as ((id: string) => void) | undefined) ?? ((_id: string) => {}))
  : (_id: string) => {};
