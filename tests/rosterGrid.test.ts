import { describe, expect, it } from "vitest";
import {
  buildRosterSaveSignature,
  consumeOverlappedTasks,
  encodeSchoolToursAsTasks,
  mergeAdjacentTasks,
  mergeMissingEmployees,
  splitGridTasksAndSchoolTours,
} from "@/lib/rosterGrid";
import { createRosterTimeline } from "@/lib/rosterTimeline";
import type { GridTask } from "@/lib/rosterTypes";

const task = (id: string, startRow: number, span: number, col = 2): GridTask => ({
  id,
  type: "gallery",
  label: "Gallery",
  col,
  startRow,
  span,
});

describe("consumeOverlappedTasks", () => {
  it("trims, drops and splits neighbours in the same column only", () => {
    const tasks = [task("before", 2, 3), task("inside", 6, 1), task("resized", 4, 4), task("after", 7, 3), task("other", 4, 4, 3)];
    const result = consumeOverlappedTasks(tasks, "resized", () => "new");
    expect(result.map((t) => [t.id, t.col, t.startRow, t.span])).toEqual([
      ["before", 2, 2, 2],
      ["resized", 2, 4, 4],
      ["after", 2, 8, 2],
      ["other", 3, 4, 4],
    ]);
  });

  it("splits a neighbour that spans both edges", () => {
    const result = consumeOverlappedTasks([task("long", 2, 10), task("resized", 5, 2)], "resized", () => "tail");
    expect(result.map((t) => [t.id, t.startRow, t.span])).toEqual([
      ["long", 2, 3],
      ["resized", 5, 2],
      ["tail", 7, 5],
    ]);
  });
});

describe("school tour records", () => {
  it("round-trip through the saved task list", () => {
    const tours = [
      { id: "b", rosterDateId: "2026-09-30", startTime: "11:00", schoolName: "Beta", studentCount: 20 },
      { id: "a", rosterDateId: "2026-09-30", startTime: "09:30", schoolName: "Alpha", studentCount: 31 },
    ];
    const saved = [task("t1", 2, 2), ...encodeSchoolToursAsTasks(tours)];
    const { gridTasks, schoolTours } = splitGridTasksAndSchoolTours(saved);
    expect(gridTasks.map((t) => t.id)).toEqual(["t1"]);
    expect(schoolTours.map((t) => t.schoolName)).toEqual(["Alpha", "Beta"]);
  });
});

describe("buildRosterSaveSignature", () => {
  it("changes when anything saved changes", () => {
    const base = { employees: [{ id: "1", name: "Ann" }], tasks: [task("t1", 2, 2)], hoursStart: "09:00" };
    const signature = buildRosterSaveSignature(base, "2026-09-30");
    expect(buildRosterSaveSignature({ ...base }, "2026-09-30")).toBe(signature);
    expect(buildRosterSaveSignature({ ...base, hoursStart: "09:15" }, "2026-09-30")).not.toBe(signature);
    expect(buildRosterSaveSignature({ ...base, tasks: [task("t1", 2, 3)] }, "2026-09-30")).not.toBe(signature);
  });
});

describe("mergeMissingEmployees", () => {
  it("adds employees missing by id and name", () => {
    const merged = mergeMissingEmployees([{ id: "1", name: "Ann" }], [{ id: "9", name: " ann " }, { id: "2", name: "Bo" }]);
    expect(merged.map((e) => e.name)).toEqual(["Ann", "Bo"]);
  });
});

describe("createRosterTimeline", () => {
  it("maps clock times to 15-minute rows", () => {
    const timeline = createRosterTimeline("08:30", "17:00");
    expect(timeline.maxRowEx).toBe(2 + 34);
    expect(timeline.rowFromTime("08:30")).toBe(2);
    expect(timeline.rowFromTime("08:40")).toBe(2);
    expect(timeline.rowFromTime("08:40", "ceil")).toBe(3);
    expect(timeline.timeRangeForSpan(2, 4)).toBe("08:30-09:30");
  });

  it("falls back to default hours and always shows at least an hour", () => {
    expect(createRosterTimeline().timeForRow(2)).toBe("09:30");
    expect(createRosterTimeline("12:00", "11:00").dayEndMin).toBe(13 * 60);
  });
});

describe("mergeAdjacentTasks", () => {
  const block = (id: string, type: string, startRow: number, span: number, col = 2): GridTask => ({
    id,
    type,
    label: type,
    col,
    startRow,
    span,
  });

  it("joins back-to-back blocks of the same task in one column", () => {
    const tasks = [block("a", "gallery", 2, 2), block("b", "gallery", 4, 1), block("c", "gallery", 5, 3), block("d", "desk", 8, 2)];
    expect(mergeAdjacentTasks(tasks, () => true).map((t) => [t.id, t.startRow, t.span])).toEqual([
      ["a", 2, 6],
      ["d", 8, 2],
    ]);
  });

  it("keeps blocks apart across gaps, columns and tasks that must stay separate", () => {
    const tasks = [
      block("a", "gallery", 2, 2),
      block("b", "gallery", 5, 1),
      block("c", "gallery", 2, 2, 3),
      block("d", "lunch", 10, 2),
      block("e", "lunch", 12, 2),
    ];
    const merged = mergeAdjacentTasks(tasks, (task) => task.type !== "lunch");
    expect(merged.map((t) => t.id)).toEqual(["a", "b", "d", "e", "c"]);
  });
});
