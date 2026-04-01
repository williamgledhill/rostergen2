import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSessionContextFromToken, type AuthRequestMeta, type AuthUser } from "@/lib/auth";
import { getConfiguredAllowedOrigins, isAllowedRequestOrigin } from "@/lib/requestOrigin";
import { SESSION_COOKIE_NAME } from "@/lib/sessionToken";

export type SessionContext = {
  sessionId: string;
  user: AuthUser;
  expiresAt: Date;
  mfaSatisfiedAt: Date | null;
};

type AuthOk = { ok: true; session: SessionContext };
type AuthFail = { ok: false; response: NextResponse };
type AuthResult = AuthOk | AuthFail;

export async function getSessionContext(): Promise<SessionContext | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionContextFromToken(rawToken);
}

export async function requireSession(options?: { adminOnly?: boolean }): Promise<AuthResult> {
  const session = await getSessionContext();
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (options?.adminOnly && session.user.role !== "ADMIN") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, session };
}

export async function requirePageSession(options?: { adminOnly?: boolean }) {
  const result = await requireSession(options);
  if (!result.ok) redirect("/signup");
  return result.session;
}

export function enforceSameOrigin(request: Request) {
  const allowedOrigins = getConfiguredAllowedOrigins();
  const isAllowed = isAllowedRequestOrigin(request.url, request.headers.get("origin"), allowedOrigins);
  if (isAllowed) return null;
  return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
}

export function getRequestMeta(request: Request): AuthRequestMeta {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0]?.trim() : null;
  return {
    ipAddress: ipAddress || null,
    userAgent: request.headers.get("user-agent"),
  };
}
