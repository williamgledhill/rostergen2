export type DaySchedule = { enabled: boolean; start: string; end: string };
export type Person = { id: string; name: string; email?: string; schedule: Record<string, DaySchedule> };

export const ALL_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export function defaultSchedule(days: string[]): Record<string, DaySchedule> {
  const schedule: Record<string, DaySchedule> = {};
  ALL_DAYS.forEach(day => {
    schedule[day] = {
      enabled: days.includes(day),
      start: "09:00",
      end: "17:00",
    };
  });
  return schedule;
}

export const seedPeople: Person[] = [
  { id: "1", name: "John",   email: "john@example.com", schedule: defaultSchedule(["Mon","Tue","Wed","Thu","Fri"]) },
  { id: "2", name: "Robert", email: "robert@example.com", schedule: defaultSchedule(["Mon","Wed","Fri"]) },
  { id: "3", name: "Mary",   email: "mary@example.com", schedule: defaultSchedule(["Tue","Thu","Sat"]) },
];

const isServer = typeof window === "undefined";
let serverStore: any = null;
if (isServer) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  serverStore = require("./peopleStore");
}

export const getPeople = isServer
  ? (serverStore?.getPeople as () => Person[])
  : () => seedPeople;

export const getPerson = isServer
  ? (serverStore?.getPerson as (id: string) => Person | null)
  : (id: string) => seedPeople.find(p => p.id === id) ?? null;

export const upsertPerson = isServer
  ? (serverStore?.upsertPerson as (p: Person) => Person)
  : (p: Person) => p;

export const deletePerson = isServer
  ? (serverStore?.deletePerson as (id: string) => void)
  : (_id: string) => {};
