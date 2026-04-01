import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createOpaqueAuthToken,
  getLoginChallengeCookieOptions,
  getSessionCookieOptions,
  hashAuthToken,
  LOGIN_CHALLENGE_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
} from "../lib/sessionToken";

const ORIGINAL_SECRET = process.env.SESSION_SECRET;

describe("session token helpers", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
  });

  afterAll(() => {
    if (typeof ORIGINAL_SECRET === "string") process.env.SESSION_SECRET = ORIGINAL_SECRET;
    else delete process.env.SESSION_SECRET;
  });

  it("creates opaque random tokens", () => {
    const one = createOpaqueAuthToken();
    const two = createOpaqueAuthToken();
    expect(one).not.toBe(two);
    expect(one.length).toBeGreaterThan(20);
  });

  it("hashes auth tokens deterministically", () => {
    expect(hashAuthToken("abc")).toBe(hashAuthToken("abc"));
    expect(hashAuthToken("abc")).not.toBe(hashAuthToken("xyz"));
  });

  it("uses strict cookie options for sessions", () => {
    expect(getSessionCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  });

  it("uses strict cookie options for login challenges", () => {
    expect(getLoginChallengeCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: LOGIN_CHALLENGE_MAX_AGE_SECONDS,
    });
  });
});
