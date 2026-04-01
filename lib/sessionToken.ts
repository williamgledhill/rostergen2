import crypto from "crypto";

export const SESSION_COOKIE_NAME = "roster_session";
export const LOGIN_CHALLENGE_COOKIE_NAME = "roster_login_challenge";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
export const LOGIN_CHALLENGE_MAX_AGE_SECONDS = 60 * 10;

const DEV_FALLBACK_SECRET = "dev-only-session-secret-change-me-now-12345";

function getSessionSecret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== "production") return DEV_FALLBACK_SECRET;
  throw new Error("SESSION_SECRET must be set and at least 32 characters in production.");
}

export function createOpaqueAuthToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashAuthToken(token: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(token).digest("base64url");
}

function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function getSessionCookieOptions() {
  return buildCookieOptions(SESSION_MAX_AGE_SECONDS);
}

export function getLoginChallengeCookieOptions() {
  return buildCookieOptions(LOGIN_CHALLENGE_MAX_AGE_SECONDS);
}
