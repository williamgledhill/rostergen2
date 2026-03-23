import crypto from "crypto";

export const SESSION_COOKIE_NAME = "roster_session";
export const SESSION_TOKEN_VERSION = "v1";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

const DEV_FALLBACK_SECRET = "dev-only-session-secret-change-me-now-12345";

export type SessionTokenClaims = {
  accountId: string;
  editorId: string;
  iat: number;
  exp: number;
};

function getSessionSecret() {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV !== "production") return DEV_FALLBACK_SECRET;
  throw new Error("SESSION_SECRET must be set and at least 32 characters in production.");
}

function sign(encodedPayload: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function constantTimeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isValidClaims(input: unknown): input is SessionTokenClaims {
  if (!input || typeof input !== "object") return false;
  const claims = input as Partial<SessionTokenClaims>;
  return (
    typeof claims.accountId === "string" &&
    claims.accountId.length > 0 &&
    claims.accountId.length <= 120 &&
    typeof claims.editorId === "string" &&
    claims.editorId.length > 0 &&
    claims.editorId.length <= 120 &&
    Number.isInteger(claims.iat) &&
    Number.isInteger(claims.exp)
  );
}

function encodePayload(payload: SessionTokenClaims) {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

function decodePayload(encoded: string): SessionTokenClaims | null {
  try {
    const raw = Buffer.from(encoded, "base64url").toString("utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return isValidClaims(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createSessionToken(accountId: string, editorId: string, nowMs = Date.now()) {
  const now = Math.floor(nowMs / 1000);
  const payload: SessionTokenClaims = {
    accountId,
    editorId,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = encodePayload(payload);
  const signature = sign(encodedPayload, getSessionSecret());
  return `${SESSION_TOKEN_VERSION}.${encodedPayload}.${signature}`;
}

export function verifySessionToken(token?: string | null, nowMs = Date.now()): SessionTokenClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [version, encodedPayload, providedSignature] = parts;
  if (version !== SESSION_TOKEN_VERSION || !encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload, getSessionSecret());
  if (!constantTimeEqual(providedSignature, expectedSignature)) return null;

  const payload = decodePayload(encodedPayload);
  if (!payload) return null;

  const now = Math.floor(nowMs / 1000);
  if (payload.exp <= now) return null;
  if (payload.iat > now + 60) return null;
  if (payload.exp - payload.iat > SESSION_MAX_AGE_SECONDS) return null;
  return payload;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
