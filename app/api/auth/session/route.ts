import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBody, serverError } from "@/lib/apiHelpers";
import { authenticateUser, revokeSession } from "@/lib/auth";
import { enforceSameOrigin, getRequestMeta, getSessionContext } from "@/lib/apiAuth";
import {
  getLoginChallengeCookieOptions,
  getSessionCookieOptions,
  LOGIN_CHALLENGE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/sessionToken";

const sessionRequestSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(512),
});

export async function GET() {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ session: null });

  return NextResponse.json({
    session: {
      user: session.user,
      expiresAt: session.expiresAt.toISOString(),
      mfaSatisfiedAt: session.mfaSatisfiedAt?.toISOString() ?? null,
    },
  });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const body = await parseJsonBody(request, sessionRequestSchema);
  if (!body.ok) return body.response;

  try {
    const authResult = await authenticateUser(body.data.email, body.data.password, getRequestMeta(request));
    if (!authResult) return jsonError("Invalid credentials", 401);
    if ("pendingApproval" in authResult) {
      return jsonError("Your account is waiting for an administrator to approve it.", 403);
    }

    if (authResult.requiresTwoFactor) {
      const response = NextResponse.json({
        requiresTwoFactor: true,
        user: { email: authResult.user.email, name: authResult.user.name },
      });
      response.cookies.set(LOGIN_CHALLENGE_COOKIE_NAME, authResult.challengeToken, getLoginChallengeCookieOptions());
      response.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(), maxAge: 0 });
      return response;
    }

    const response = NextResponse.json({ session: { user: authResult.user } });
    response.cookies.set(SESSION_COOKIE_NAME, authResult.sessionToken, getSessionCookieOptions());
    response.cookies.set(LOGIN_CHALLENGE_COOKIE_NAME, "", { ...getLoginChallengeCookieOptions(), maxAge: 0 });
    return response;
  } catch (err) {
    return serverError(err, "Could not sign in. Please try again.");
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const rawToken = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (rawToken) await revokeSession(rawToken);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(), maxAge: 0 });
  response.cookies.set(LOGIN_CHALLENGE_COOKIE_NAME, "", { ...getLoginChallengeCookieOptions(), maxAge: 0 });
  return response;
}
