import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSessionToken, SESSION_MAX_AGE_SECONDS, verifySessionToken } from "../lib/sessionToken";

const ORIGINAL_SECRET = process.env.SESSION_SECRET;

describe("session token signing", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
  });

  afterAll(() => {
    if (typeof ORIGINAL_SECRET === "string") process.env.SESSION_SECRET = ORIGINAL_SECRET;
    else delete process.env.SESSION_SECRET;
  });

  it("creates and verifies a signed token", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const token = createSessionToken("mint", "admin", now);
    const claims = verifySessionToken(token, now);
    expect(claims).not.toBeNull();
    expect(claims?.accountId).toBe("mint");
    expect(claims?.editorId).toBe("admin");
  });

  it("rejects tampered payloads", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const token = createSessionToken("mint", "editor-1", now);
    const parts = token.split(".");
    parts[1] = Buffer.from(
      JSON.stringify({
        accountId: "mint",
        editorId: "admin",
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + SESSION_MAX_AGE_SECONDS,
      }),
      "utf-8"
    ).toString("base64url");
    const tampered = parts.join(".");
    expect(verifySessionToken(tampered, now)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const issuedAt = now - (SESSION_MAX_AGE_SECONDS + 10) * 1000;
    const token = createSessionToken("mint", "editor-1", issuedAt);
    expect(verifySessionToken(token, now)).toBeNull();
  });

  it("rejects tokens issued too far in the future", () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const token = createSessionToken("mint", "editor-1", now + 5 * 60 * 1000);
    expect(verifySessionToken(token, now)).toBeNull();
  });

  it("rejects unsupported legacy cookie formats", () => {
    expect(verifySessionToken("mint|admin")).toBeNull();
  });
});
