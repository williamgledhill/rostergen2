import { describe, expect, it } from "vitest";
import { checkPasswordRules, meetsPasswordPolicy } from "@/lib/passwordRules";

describe("password policy", () => {
  it("accepts 12+ characters with a capital letter and a special character", () => {
    expect(meetsPasswordPolicy("Roster-planner1")).toBe(true);
    expect(meetsPasswordPolicy("Correct horse battery!")).toBe(true);
  });

  it("rejects passwords shorter than 12 characters", () => {
    expect(meetsPasswordPolicy("Short-pass1")).toBe(false);
    expect(meetsPasswordPolicy("   Ab!         ")).toBe(false);
  });

  it("requires a capital letter", () => {
    expect(meetsPasswordPolicy("all-lowercase-here")).toBe(false);
  });

  it("requires a special character, not just letters, numbers or spaces", () => {
    expect(meetsPasswordPolicy("NoSpecialChars123")).toBe(false);
    expect(meetsPasswordPolicy("Spaces Only Here")).toBe(false);
  });

  it("reports each rule separately for the checklist", () => {
    expect(checkPasswordRules("abc").map((rule) => rule.met)).toEqual([false, false, false]);
    expect(checkPasswordRules("Abcdefghijk!").map((rule) => rule.met)).toEqual([true, true, true]);
  });
});
