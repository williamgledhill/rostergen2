import { describe, expect, it } from "vitest";
import { formatLocalId } from "../lib/dateUtils";
import { buildUpcomingRosterWindow, type RosterFile } from "../lib/rosters";

function atLocalNoon(year: number, month: number, day: number) {
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function makeRoster(date: Date, overrides: Partial<RosterFile> = {}): RosterFile {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return {
    id: formatLocalId(day),
    title: `Roster ${formatLocalId(day)}`,
    start: day,
    end: day,
    status: "Draft",
    updated: "Mar 1, 2026",
    tours: 2,
    people: 5,
    employees: [{ id: "1", name: "Alex" }],
    tasks: [{ id: "task-1", type: "tour" }],
    ...overrides,
  };
}

describe("buildUpcomingRosterWindow", () => {
  it("returns one row per day and auto-generates blanks for missing dates", () => {
    const today = atLocalNoon(2026, 3, 23);
    const rosterToday = makeRoster(today, {
      status: "Published",
      tours: 3,
      people: 6,
      updated: "Mar 23, 2026",
    });
    const rosterTwoDaysAhead = makeRoster(atLocalNoon(2026, 3, 25), {
      tours: 1,
      people: 2,
    });

    const rows = buildUpcomingRosterWindow([rosterToday, rosterTwoDaysAhead], 3, today);

    expect(rows.map((r) => r.id)).toEqual(["2026-03-23", "2026-03-24", "2026-03-25"]);
    expect(rows[0].status).toBe("Published");
    expect(rows[1]).toMatchObject({
      id: "2026-03-24",
      status: "Draft",
      updated: "-",
      tours: 0,
      people: 0,
      employees: [],
      tasks: [],
    });
    expect(rows[2]).toMatchObject({
      id: "2026-03-25",
      tours: 1,
      people: 2,
    });
  });

  it("clamps requested day count to supported bounds", () => {
    const today = atLocalNoon(2026, 3, 23);
    const low = buildUpcomingRosterWindow([], 0, today);
    const high = buildUpcomingRosterWindow([], 999, today);

    expect(low).toHaveLength(1);
    expect(low[0].id).toBe("2026-03-23");
    expect(high).toHaveLength(90);
  });

  it("ignores out-of-window entries and normalizes malformed in-window roster values", () => {
    const today = atLocalNoon(2026, 3, 23);
    const beforeWindow = makeRoster(atLocalNoon(2026, 3, 22));
    const afterWindow = makeRoster(atLocalNoon(2026, 3, 30));
    const malformedInWindow = makeRoster(atLocalNoon(2026, 3, 24), {
      id: "custom-id",
      title: "",
      updated: "",
      tours: Number.NaN,
      people: Number.NaN,
      employees: [{ id: "emp-1" }],
      tasks: [{ type: "tour" }, { type: "front" }],
    });

    const rows = buildUpcomingRosterWindow([beforeWindow, afterWindow, malformedInWindow], 3, today);

    expect(rows.map((r) => r.id)).toEqual(["2026-03-23", "2026-03-24", "2026-03-25"]);
    expect(rows[1].title).not.toBe("");
    expect(rows[1].updated).toBe("-");
    expect(rows[1].tours).toBe(1);
    expect(rows[1].people).toBe(1);
  });
});

