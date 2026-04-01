import { describe, expect, it } from "vitest";
import {
  buildOtpAuthUri,
  decryptSecret,
  encryptSecret,
  hashRecoveryCode,
  matchesRecoveryCode,
  verifyTotpCode,
} from "../lib/totp";

describe("totp helpers", () => {
  it("verifies an RFC6238 reference code", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(verifyTotpCode(secret, "287082", 59_000)).toBe(true);
    expect(verifyTotpCode(secret, "000000", 59_000)).toBe(false);
  });

  it("encrypts and decrypts shared secrets", () => {
    const encrypted = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(encrypted.ciphertext, encrypted.nonce)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("matches and consumes recovery codes", () => {
    const stored = [hashRecoveryCode("ABCD2345"), hashRecoveryCode("ZXCV6789")];
    const result = matchesRecoveryCode("ABCD2345", stored);
    expect(result.matched).toBe(true);
    expect(result.nextHashedCodes).toHaveLength(1);
  });

  it("builds an otpauth URI", () => {
    const uri = buildOtpAuthUri("admin@example.com", "JBSWY3DPEHPK3PXP");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("issuer=Roster+Planner");
  });
});
