import { describe, expect, it } from "vitest";
import { generateAutofillRoster, type AutofillInput } from "@/lib/autofill/generateRoster";
import { defaultSchedule, type Person } from "@/lib/people";
import { createRosterTimeline } from "@/lib/rosterTimeline";
import type { GridTask } from "@/lib/rosterTypes";
import type { TaskTemplate } from "@/lib/taskTemplates";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
// A Wednesday.
const ROSTER_DATE = new Date(2026, 8, 30);

function person(id: string, start = "09:00", end = "17:00"): Person {
  const schedule = defaultSchedule(WEEKDAYS);
  WEEKDAYS.forEach((day) => {
    schedule[day as keyof typeof schedule] = { enabled: true, start, end };
  });
  return { id, name: `Person ${id}`, schedule };
}

function template(overrides: Partial<TaskTemplate> & { id: string }): TaskTemplate {
  return { name: overrides.id, description: "", regularDays: WEEKDAYS, color: "#cccccc", ...overrides };
}

function run(overrides: Partial<AutofillInput> = {}) {
  let id = 0;
  const people = overrides.people ?? [person("1"), person("2"), person("3")];
  return generateAutofillRoster({
    employees: people.map((p) => ({ id: p.id, name: p.name })),
    people,
    templates: [],
    schoolTours: [],
    rosterDate: ROSTER_DATE,
    timeline: createRosterTimeline("09:00", "17:00"),
    variant: 0,
    createId: () => `task-${++id}`,
    ...overrides,
  });
}

function overlapsInSameColumn(tasks: GridTask[]) {
  return tasks.some((a, i) =>
    tasks.some(
      (b, j) => i < j && a.col === b.col && a.startRow < b.startRow + b.span && b.startRow < a.startRow + a.span
    )
  );
}

function rowsCoveredBy(tasks: GridTask[], type: string) {
  const rows = new Set<number>();
  tasks.filter((t) => t.type === type).forEach((t) => {
    for (let r = t.startRow; r < t.startRow + t.span; r += 1) rows.add(r);
  });
  return rows;
}

describe("generateAutofillRoster", () => {
  it("returns no tasks and leaves the notice alone when nobody is rostered", () => {
    const result = run({ employees: [], templates: [template({ id: "desk", mustManned: true })] });
    expect(result).toEqual({ tasks: [] });
  });

  it("keeps a must-be-manned task covered for the whole day without overlaps", () => {
    const result = run({
      templates: [template({ id: "desk", mustManned: true }), template({ id: "gallery" })],
    });
    const timeline = createRosterTimeline("09:00", "17:00");
    const deskRows = rowsCoveredBy(result.tasks, "desk");
    for (let row = 2; row < timeline.maxRowEx; row += 1) expect(deskRows.has(row)).toBe(true);
    expect(overlapsInSameColumn(result.tasks)).toBe(false);
    expect(result.notice).toBeNull();
  });

  it("lets spare people join a must-be-manned task alongside other floor tasks", () => {
    const people = [person("1"), person("2"), person("3"), person("4")];
    const result = run({
      people,
      templates: [template({ id: "desk", mustManned: true }), template({ id: "gallery" })],
    });
    const timeline = createRosterTimeline("09:00", "17:00");
    let peak = 0;
    for (let row = 2; row < timeline.maxRowEx; row += 1) {
      peak = Math.max(peak, result.tasks.filter((t) => t.type === "desk" && row >= t.startRow && row < t.startRow + t.span).length);
    }
    expect(peak).toBeGreaterThan(1);
    expect(result.tasks.some((t) => t.type === "gallery")).toBe(true);
    expect(overlapsInSameColumn(result.tasks)).toBe(false);
  });

  it("rotates people off desk and gallery after an hour when no limit is set", () => {
    const people = [person("1"), person("2"), person("3"), person("4")];
    for (const variant of [0, 1, 2]) {
      const result = run({
        people,
        variant,
        templates: [template({ id: "desk", mustManned: true }), template({ id: "gallery" })],
      });
      expect(result.tasks.filter((t) => t.span > 4)).toEqual([]);
      expect(result.notice).toBeNull();
    }
  });

  it("keeps the only person on cover past an hour rather than leave it unmanned", () => {
    const result = run({ people: [person("1")], templates: [template({ id: "desk", mustManned: true })] });
    const timeline = createRosterTimeline("09:00", "17:00");
    const deskRows = rowsCoveredBy(result.tasks, "desk");
    for (let row = 2; row < timeline.maxRowEx; row += 1) expect(deskRows.has(row)).toBe(true);
    expect(result.notice).toBeNull();
  });

  describe("tasks that go with another task", () => {
    const lunch = template({
      id: "lunch",
      durationMinutes: 30,
      minPerEmployeePerDay: 1,
      maxPerEmployeePerDay: 1,
      autogenStart: "12:00",
      autogenEnd: "14:00",
    });

    it("places the paired task straight after every block of its partner, for the same person", () => {
      const result = run({
        templates: [
          lunch,
          template({ id: "admin", durationMinutes: 30, pairedWithTaskId: "lunch", pairedPosition: "after" }),
          template({ id: "gallery" }),
        ],
      });
      const lunches = result.tasks.filter((t) => t.type === "lunch");
      const admins = result.tasks.filter((t) => t.type === "admin");
      expect(lunches).toHaveLength(3);
      expect(admins).toHaveLength(3);
      for (const block of lunches) {
        expect(
          admins.some((a) => a.employeeId === block.employeeId && a.startRow === block.startRow + block.span && a.span === 2)
        ).toBe(true);
      }
      expect(overlapsInSameColumn(result.tasks)).toBe(false);
    });

    it("can go straight before its partner instead", () => {
      const result = run({
        templates: [
          lunch,
          template({ id: "admin", durationMinutes: 15, pairedWithTaskId: "lunch", pairedPosition: "before" }),
          template({ id: "gallery" }),
        ],
      });
      const lunches = result.tasks.filter((t) => t.type === "lunch");
      const admins = result.tasks.filter((t) => t.type === "admin");
      expect(admins).toHaveLength(lunches.length);
      for (const block of lunches) {
        expect(admins.some((a) => a.employeeId === block.employeeId && a.startRow + a.span === block.startRow)).toBe(true);
      }
    });

    it("isn't placed on its own when its partner isn't running", () => {
      const result = run({
        templates: [
          { ...lunch, enabled: false },
          template({ id: "admin", durationMinutes: 30, pairedWithTaskId: "lunch" }),
          template({ id: "gallery" }),
        ],
      });
      expect(result.tasks.some((t) => t.type === "admin")).toBe(false);
    });
  });

  describe("more than one time range in a day", () => {
    const timeline = createRosterTimeline("09:00", "17:00");
    const ranges = {
      regularDayWindows: { Wed: { start: "10:00", end: "12:00" } },
      extraDayWindows: { Wed: [{ start: "14:00", end: "16:00" }] },
    };
    const outsideRanges = (tasks: GridTask[], type: string) =>
      tasks
        .filter((t) => t.type === type)
        .some((t) => {
          const start = t.startRow;
          const end = t.startRow + t.span;
          const inFirst = start >= timeline.rowFromTime("10:00")! && end <= timeline.rowFromTime("12:00")!;
          const inSecond = start >= timeline.rowFromTime("14:00")! && end <= timeline.rowFromTime("16:00")!;
          return !inFirst && !inSecond;
        });

    it("only fills spare time inside the ranges, never the gap between them", () => {
      const result = run({ timeline, templates: [template({ id: "kids", ...ranges }), template({ id: "gallery" })] });
      expect(result.tasks.some((t) => t.type === "kids")).toBe(true);
      expect(outsideRanges(result.tasks, "kids")).toBe(false);
    });

    it("covers a must-be-manned task in each range and doesn't report the gap as unmanned", () => {
      const result = run({
        timeline,
        templates: [template({ id: "desk", name: "Front Desk", mustManned: true, ...ranges }), template({ id: "gallery" })],
      });
      const deskRows = rowsCoveredBy(result.tasks, "desk");
      for (const [from, to] of [["10:00", "12:00"], ["14:00", "16:00"]]) {
        for (let row = timeline.rowFromTime(from)!; row < timeline.rowFromTime(to)!; row += 1) {
          expect(deskRows.has(row)).toBe(true);
        }
      }
      expect(outsideRanges(result.tasks, "desk")).toBe(false);
      expect(result.notice).toBeNull();
    });

    it("runs only in the other ranges when the first one is empty", () => {
      const result = run({
        timeline,
        templates: [
          template({ id: "kids", regularDayWindows: {}, extraDayWindows: { Wed: [{ start: "14:00", end: "16:00" }] } }),
          template({ id: "gallery" }),
        ],
      });
      const kids = result.tasks.filter((t) => t.type === "kids");
      expect(kids.length).toBeGreaterThan(0);
      expect(kids.every((t) => t.startRow >= timeline.rowFromTime("14:00")!)).toBe(true);
    });

    it("keeps a per-person task like a break inside one of the ranges", () => {
      const result = run({
        timeline,
        templates: [
          template({ id: "break", durationMinutes: 30, minPerEmployeePerDay: 1, maxPerEmployeePerDay: 1, ...ranges }),
          template({ id: "gallery" }),
        ],
      });
      expect(result.tasks.filter((t) => t.type === "break")).toHaveLength(3);
      expect(outsideRanges(result.tasks, "break")).toBe(false);
    });
  });

  it("gives every employee their minimum of a task", () => {
    const result = run({
      templates: [
        template({ id: "lunch", durationMinutes: 30, minPerEmployeePerDay: 1, maxPerEmployeePerDay: 1, autogenStart: "12:00", autogenEnd: "14:00" }),
        template({ id: "gallery" }),
      ],
    });
    const lunches = result.tasks.filter((t) => t.type === "lunch");
    expect(lunches.map((t) => t.employeeId).sort()).toEqual(["1", "2", "3"]);
    expect(lunches.every((t) => t.span === 2)).toBe(true);
  });

  it("only places tasks inside each employee's shift", () => {
    const people = [person("1", "09:00", "12:00"), person("2", "13:00", "17:00")];
    const timeline = createRosterTimeline("09:00", "17:00");
    const result = run({ people, timeline, templates: [template({ id: "gallery" })] });
    const noon = timeline.rowFromTime("12:00")!;
    const onePm = timeline.rowFromTime("13:00")!;
    for (const task of result.tasks) {
      if (task.employeeId === "1") expect(task.startRow + task.span).toBeLessThanOrEqual(noon);
      if (task.employeeId === "2") expect(task.startRow).toBeGreaterThanOrEqual(onePm);
    }
  });

  it("places fixed-time tasks at their set time, including the waiting lead-in", () => {
    const timeline = createRosterTimeline("09:00", "17:00");
    const result = run({
      timeline,
      templates: [template({ id: "tour", durationMinutes: 60, waitingMinutes: 15, regularTimes: ["11:00"] })],
    });
    const tours = result.tasks.filter((t) => t.type === "tour");
    expect(tours).toHaveLength(1);
    expect(tours[0].startRow).toBe(timeline.rowFromTime("10:45"));
    expect(tours[0].span).toBe(5);
  });

  it("reports cover it could not provide", () => {
    const result = run({
      people: [person("1", "10:00", "17:00")],
      templates: [template({ id: "desk", name: "Front Desk", mustManned: true })],
    });
    expect(result.notice?.messages).toEqual(["Autofill could not fully man: Front Desk 09:00-10:00"]);
  });

  it("numbers imported school tours in start-time order", () => {
    const timeline = createRosterTimeline("09:00", "17:00");
    const result = run({
      timeline,
      templates: [template({ id: "school", durationMinutes: 60, schoolTourImportTarget: true })],
      schoolTours: [
        { id: "s2", rosterDateId: "2026-09-30", startTime: "13:30", schoolName: "Dominic College", studentCount: 42 },
        { id: "s1", rosterDateId: "2026-09-30", startTime: "09:30", schoolName: "Perth College", studentCount: 25 },
      ],
    });
    const first = result.tasks.find((t) => t.label === "School Tour 1");
    const second = result.tasks.find((t) => t.label === "School Tour 2");
    expect(first?.startRow).toBe(timeline.rowFromTime("09:30"));
    expect(second?.startRow).toBe(timeline.rowFromTime("13:30"));
    expect(first?.type).toBe("school");
  });

  it("gives different but equally valid rosters for different variants", () => {
    const templates = [template({ id: "desk", mustManned: true }), template({ id: "gallery" })];
    const first = run({ templates, variant: 0 });
    const second = run({ templates, variant: 1 });
    expect(first.tasks).not.toEqual(second.tasks);
    expect(overlapsInSameColumn(second.tasks)).toBe(false);
  });

  describe("floor time", () => {
    const floor = [
      template({ id: "gallery", maxConcurrentPerTimeslot: 1 }),
      template({ id: "kids", maxConcurrentPerTimeslot: 1 }),
      template({ id: "flex" }),
    ];
    const people = [person("1"), person("2"), person("3"), person("4")];
    const timeline = createRosterTimeline("09:00", "17:00");

    const peakAt = (tasks: GridTask[], type: string) => {
      let peak = 0;
      for (let row = 2; row < timeline.maxRowEx; row += 1) {
        peak = Math.max(peak, tasks.filter((t) => t.type === type && row >= t.startRow && row < t.startRow + t.span).length);
      }
      return peak;
    };

    it("never puts more people on a floor task than its cap", () => {
      const { tasks } = run({ people, timeline, templates: floor });
      expect(peakAt(tasks, "gallery")).toBe(1);
      expect(peakAt(tasks, "kids")).toBe(1);
      expect(overlapsInSameColumn(tasks)).toBe(false);
    });

    it("keeps capped floor tasks staffed and only overflows into uncapped ones", () => {
      const { tasks } = run({ people, timeline, templates: floor });
      for (let row = 2; row < timeline.maxRowEx; row += 1) {
        const at = (type: string) => tasks.some((t) => t.type === type && row >= t.startRow && row < t.startRow + t.span);
        expect(at("gallery") && at("kids")).toBe(true);
      }
    });

    it("moves people on after an hour and shares the tasks around", () => {
      const { tasks } = run({ people, timeline, templates: floor });
      // Uncapped overflow time is merged into one block per person, so check the capped tasks.
      const capped = tasks.filter((t) => t.type === "gallery" || t.type === "kids");
      expect(Math.max(...capped.map((t) => t.span))).toBeLessThanOrEqual(4);
      for (const p of people) {
        const kinds = new Set(tasks.filter((t) => t.employeeId === p.id).map((t) => t.type));
        expect(kinds.size).toBeGreaterThan(1);
      }
    });

    it("uses a task's own time limit as the stint length", () => {
      const { tasks } = run({
        people: [person("1")],
        timeline,
        templates: [template({ id: "gallery", maxConsecutiveMinutes: 30 }), template({ id: "kids", maxConsecutiveMinutes: 30 })],
      });
      expect(tasks.every((t) => t.span <= 2)).toBe(true);
    });
  });

  describe("regressions found with real rosters", () => {
    const timeline = createRosterTimeline("08:00", "17:00");

    it("places a tour whose block (with waiting time) is longer than its time-in-one-go limit", () => {
      const result = run({
        people: [person("1", "08:00", "17:00")],
        timeline,
        templates: [
          template({
            id: "school",
            mustManned: true,
            overwriteExistingTasks: true,
            durationMinutes: 60,
            waitingMinutes: 15,
            maxConsecutiveMinutes: 60,
            schoolTourImportTarget: true,
          }),
        ],
        schoolTours: [{ id: "s1", rosterDateId: "2026-09-30", startTime: "10:00", schoolName: "Hill School", studentCount: 30 }],
      });
      expect(result.tasks.some((t) => t.label === "School Tour 1")).toBe(true);
      expect(result.notice?.messages.join(" ") ?? "").not.toMatch(/school tours/);
    });

    it("still gives others their break when someone's shift ends before the break window", () => {
      const result = run({
        people: [person("1", "08:00", "16:00"), person("2", "08:00", "16:00"), person("3", "08:00", "14:30")],
        timeline,
        templates: [
          template({
            id: "afternoon",
            minPerEmployeePerDay: 1,
            maxPerEmployeePerDay: 1,
            maxConsecutiveMinutes: 15,
            regularDayWindows: { Wed: { start: "14:30", end: "16:00" } },
          }),
          template({ id: "gallery" }),
        ],
      });
      const breaks = result.tasks.filter((t) => t.type === "afternoon").map((t) => t.employeeId).sort();
      expect(breaks).toEqual(["1", "2"]);
      expect(result.notice).toBeNull();
    });

    it("covers the desk right up to an all-staff briefing and doesn't report the briefing as a gap", () => {
      const result = run({
        people: [person("1", "08:00", "17:00"), person("2", "08:00", "17:00")],
        timeline,
        templates: [
          template({ id: "desk", name: "Front Desk", mustManned: true, regularDayWindows: { Wed: { start: "08:30", end: "17:00" } } }),
          template({ id: "briefing", attendedByAll: true, overwriteExistingTasks: true, durationMinutes: 15, regularTimesByDay: { Wed: ["09:00"] } }),
          template({ id: "gallery" }),
        ],
      });
      const eightThirty = timeline.rowFromTime("08:30")!;
      expect(result.tasks.some((t) => t.type === "desk" && t.startRow === eightThirty)).toBe(true);
      expect(result.notice).toBeNull();
    });
  });

  describe("waiting time that can be covered", () => {
    const timeline = createRosterTimeline("09:00", "17:00");
    const tour = (overrides: Partial<TaskTemplate> = {}) =>
      template({
        id: "tour",
        name: "Public Tour",
        category: "Tours",
        mustManned: true,
        overwriteExistingTasks: true,
        durationMinutes: 45,
        waitingMinutes: 15,
        waitingCanBeCovered: true,
        ...overrides,
      });
    const briefing = template({
      id: "briefing",
      attendedByAll: true,
      overwriteExistingTasks: true,
      durationMinutes: 15,
      regularTimesByDay: { Wed: ["10:15"] },
    });

    it("lets an all-staff briefing keep the waiting time so the tour starts on time", () => {
      const result = run({
        people: [person("1"), person("2")],
        timeline,
        templates: [briefing, tour({ regularTimes: ["10:30"] }), template({ id: "gallery" })],
      });
      const tours = result.tasks.filter((t) => t.type === "tour");
      expect(tours).toHaveLength(1);
      expect(tours[0].startRow).toBe(timeline.rowFromTime("10:30"));
      expect(tours[0].waitingMinutes).toBe(0);
      expect(result.tasks.filter((t) => t.type === "briefing")).toHaveLength(2);
      expect(overlapsInSameColumn(result.tasks)).toBe(false);
      expect(result.notice).toBeNull();
    });

    it("still reports the clash when the waiting time can't be covered", () => {
      const result = run({
        people: [person("1"), person("2")],
        timeline,
        templates: [briefing, tour({ regularTimes: ["10:30"], waitingCanBeCovered: false }), template({ id: "gallery" })],
      });
      expect(result.tasks.some((t) => t.type === "tour")).toBe(false);
      expect(result.notice?.messages.join(" ")).toContain("Public Tour 10:15-11:15");
    });

    it("keeps the only person on the front desk through the waiting time", () => {
      const result = run({
        people: [person("1")],
        timeline,
        templates: [template({ id: "desk", name: "Front Desk", mustManned: true }), tour({ regularTimes: ["11:00"] })],
      });
      const tourTask = result.tasks.find((t) => t.type === "tour");
      expect(tourTask?.startRow).toBe(timeline.rowFromTime("11:00"));
      expect(tourTask?.waitingMinutes).toBe(0);
      const deskRows = rowsCoveredBy(result.tasks, "desk");
      expect(deskRows.has(timeline.rowFromTime("10:45")!)).toBe(true);
      expect(overlapsInSameColumn(result.tasks)).toBe(false);
    });
  });

  it("shares tours of every kind out so nobody gets a second until everyone has had one", () => {
    const people = [person("1"), person("2"), person("3"), person("4"), person("5")];
    const tour = { mustManned: true, overwriteExistingTasks: true, durationMinutes: 45, waitingMinutes: 15, category: "Tours" };
    for (const variant of [0, 1, 2, 3]) {
      const { tasks } = run({
        people,
        variant,
        timeline: createRosterTimeline("09:00", "17:00"),
        templates: [
          template({ id: "public", ...tour, regularTimes: ["10:00", "11:00", "14:00"] }),
          template({ id: "school", ...tour, durationMinutes: 60, schoolTourImportTarget: true, enabled: false }),
          template({ id: "gallery" }),
        ],
        schoolTours: ["09:30", "12:00", "13:00"].map((startTime, i) => ({
          id: `s${i}`,
          rosterDateId: "2026-09-30",
          startTime,
          schoolName: `School ${i}`,
          studentCount: 20,
        })),
      });
      const perPerson = people.map((p) => tasks.filter((t) => t.employeeId === p.id && ["public", "school"].includes(t.type)).length);
      expect(perPerson.reduce((a, b) => a + b, 0)).toBe(6);
      expect(Math.max(...perPerson) - Math.min(...perPerson)).toBeLessThanOrEqual(1);
    }
  });
});
