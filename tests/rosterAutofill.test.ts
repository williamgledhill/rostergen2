import { describe, expect, it } from "vitest";
import {
  getAutofillTemplatePriority,
  getPreferredConcurrentLimit,
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

  it("tries one-at-a-time breaks before allowing unlimited overlap", () => {
    expect(getPreferredConcurrentLimit(Number.POSITIVE_INFINITY, { preferSolo: true })).toBe(1);
    expect(getPreferredConcurrentLimit(3, { preferSolo: true })).toBe(1);
  });

  it("keeps stricter configured limits intact", () => {
    expect(getPreferredConcurrentLimit(1, { preferSolo: true })).toBe(1);
    expect(getPreferredConcurrentLimit(1)).toBe(1);
  });
});
