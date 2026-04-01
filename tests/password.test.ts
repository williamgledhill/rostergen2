import { describe, expect, it } from "vitest";
import { hashPassword, validatePasswordStrength, verifyPassword } from "../lib/password";

describe("password hashing", () => {
  it("hashes and verifies valid passwords", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect", hash)).resolves.toBe(false);
  });

  it("enforces a minimum password length policy", () => {
    expect(validatePasswordStrength("short")).toBe(false);
    expect(validatePasswordStrength("long-enough-password")).toBe(true);
  });
});
