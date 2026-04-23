import { describe, expect, it } from "vitest";
import {
  clipTaskAroundBlockedRange,
  compareFutureMinimumAvailability,
  getFeasiblePlacementRows,
  getAutofillTemplatePriority,
  getPreferredConcurrentLimit,
  isAutofillFillerTemplate,
  regularDayAppliesToAutofill,
  resolveAutofillTimeSlots,
} from "../lib/rosterAutofill";

describe("roster autofill preferences", () => {
  it("prioritizes continuous required coverage ahead of break minimums", () => {
    const requiredCoverage = getAutofillTemplatePriority({
      mustManned: true,
      hasFixedTimes: false,
      minPerEmp: 0,
    });
    const lunchMinimums = getAutofillTemplatePriority({
      mustManned: false,
      hasFixedTimes: false,
      minPerEmp: 1,
    });

    expect(requiredCoverage).toBeGreaterThan(lunchMinimums);
  });

  it("prioritizes all-attend templates above normal coverage", () => {
    const briefing = getAutofillTemplatePriority({
      mustManned: false,
      hasFixedTimes: true,
      minPerEmp: 0,
      attendedByAll: true,
    });
    const requiredCoverage = getAutofillTemplatePriority({
      mustManned: true,
      hasFixedTimes: true,
      minPerEmp: 0,
    });

    expect(briefing).toBeGreaterThan(requiredCoverage);
  });

  it("tries one-at-a-time breaks before allowing unlimited overlap", () => {
    expect(getPreferredConcurrentLimit(Number.POSITIVE_INFINITY, { preferSolo: true })).toBe(1);
    expect(getPreferredConcurrentLimit(3, { preferSolo: true })).toBe(1);
  });

  it("keeps stricter configured limits intact", () => {
    expect(getPreferredConcurrentLimit(1, { preferSolo: true })).toBe(1);
    expect(getPreferredConcurrentLimit(1)).toBe(1);
  });

  it("treats day-specific slots on other days as fixed-time scheduling", () => {
    expect(
      resolveAutofillTimeSlots({
        dayKey: "Thu",
        regularTimesByDay: {
          Mon: ["11:00"],
          Tue: ["11:00"],
          Fri: ["11:00"],
        },
      })
    ).toEqual({
      regularTimes: [],
      hasAnyFixedTimes: true,
    });
  });

  it("falls back to default slots when a day has no specific override", () => {
    expect(
      resolveAutofillTimeSlots({
        dayKey: "Thu",
        regularTimes: ["10:30"],
        regularTimesByDay: {
          Fri: ["11:00"],
        },
      })
    ).toEqual({
      regularTimes: ["10:30"],
      hasAnyFixedTimes: true,
    });
  });

  it("does not autofill tasks with no selected regular days", () => {
    expect(
      regularDayAppliesToAutofill({
        dayKey: "Thu",
        regularDays: [],
        regularTimes: [],
        regularTimesByDay: {},
      })
    ).toBe(false);
  });

  it("autofills tasks on explicitly selected regular days", () => {
    expect(
      regularDayAppliesToAutofill({
        dayKey: "Thu",
        regularDays: ["Mon", "Thu"],
      })
    ).toBe(true);
    expect(
      regularDayAppliesToAutofill({
        dayKey: "Fri",
        regularDays: ["Mon", "Thu"],
      })
    ).toBe(false);
  });

  it("autofills fixed-time tasks with default slots even when no regular days are selected", () => {
    expect(
      regularDayAppliesToAutofill({
        dayKey: "Thu",
        regularDays: [],
        regularTimes: ["10:30"],
      })
    ).toBe(true);
  });

  it("autofills fixed-time tasks only on matching day-specific slots", () => {
    expect(
      regularDayAppliesToAutofill({
        dayKey: "Fri",
        regularDays: [],
        regularTimesByDay: { Fri: ["11:00"], Mon: ["11:00"] },
      })
    ).toBe(true);
    expect(
      regularDayAppliesToAutofill({
        dayKey: "Thu",
        regularDays: [],
        regularTimesByDay: { Fri: ["11:00"], Mon: ["11:00"] },
      })
    ).toBe(false);
  });

  it("does not use required breaks as filler after their minimum placement", () => {
    expect(
      isAutofillFillerTemplate({
        hasFixedTimes: false,
        mustManned: false,
        minPerEmp: 1,
      })
    ).toBe(false);
    expect(
      isAutofillFillerTemplate({
        hasFixedTimes: false,
        mustManned: false,
        minPerEmp: 0,
      })
    ).toBe(true);
  });

  it("identifies when a required coverage block would remove the last lunch slot", () => {
    const candidateRows = [18, 19, 20, 21, 22, 23, 24];
    const withoutConflict = getFeasiblePlacementRows({
      candidateRows,
      span: 2,
      employeeWindow: { startRow: 6, endRow: 38 },
      occupiedRanges: [{ startRow: 21, span: 4 }],
    });
    const withConflict = getFeasiblePlacementRows({
      candidateRows,
      span: 2,
      employeeWindow: { startRow: 6, endRow: 38 },
      occupiedRanges: [{ startRow: 21, span: 4 }],
      blockedRange: { startRow: 18, span: 2 },
    });

    expect(withoutConflict).toEqual([18, 19]);
    expect(withConflict).toEqual([]);
  });

  it("prefers employees who preserve more future break options", () => {
    const rowanFutureOptions = [2, 4, 5];
    const kayeFutureOptions = [0, 4, 5];

    expect(compareFutureMinimumAvailability(rowanFutureOptions, kayeFutureOptions)).toBeLessThan(0);
    expect(compareFutureMinimumAvailability(kayeFutureOptions, rowanFutureOptions)).toBeGreaterThan(0);
  });

  it("clips only the waiting segment when an override takes the lead-in slot", () => {
    const fragments = clipTaskAroundBlockedRange(
      {
        startRow: 10,
        span: 4,
        waitingMinutes: 15,
        packingMinutes: 0,
      },
      { startRow: 10, span: 1 }
    );

    expect(fragments).toEqual([
      {
        startRow: 11,
        span: 3,
        waitingMinutes: 0,
        packingMinutes: 0,
      },
    ]);
  });

  it("keeps valid task fragments on both sides of a blocked middle range", () => {
    const fragments = clipTaskAroundBlockedRange(
      {
        startRow: 20,
        span: 6,
        waitingMinutes: 15,
        packingMinutes: 15,
      },
      { startRow: 22, span: 2 }
    );

    expect(fragments).toEqual([
      {
        startRow: 20,
        span: 2,
        waitingMinutes: 15,
        packingMinutes: 0,
      },
      {
        startRow: 24,
        span: 2,
        waitingMinutes: 0,
        packingMinutes: 15,
      },
    ]);
  });
});
