import { NextResponse } from "next/server";
import { z } from "zod";
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
  if (!session) {
    return NextResponse.json({ session: null });
  }

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

  try {
    const parsed = sessionRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const authResult = await authenticateUser(parsed.data.email, parsed.data.password, getRequestMeta(request));
    if (!authResult) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (authResult.requiresTwoFactor) {
      const response = NextResponse.json({
        requiresTwoFactor: true,
        user: {
          email: authResult.user.email,
          name: authResult.user.name,
        },
      });
      response.cookies.set(
        LOGIN_CHALLENGE_COOKIE_NAME,
        authResult.challengeToken,
        getLoginChallengeCookieOptions()
      );
      response.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(), maxAge: 0 });
      return response;
    }

    const response = NextResponse.json({
      session: {
        user: authResult.user,
      },
    });
    response.cookies.set(SESSION_COOKIE_NAME, authResult.sessionToken, getSessionCookieOptions());
    response.cookies.set(LOGIN_CHALLENGE_COOKIE_NAME, "", {
      ...getLoginChallengeCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create session" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const session = await getSessionContext();
  const cookieHeader = request.headers.get("cookie") || "";
  const rawToken = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);

  if (session && rawToken) {
    await revokeSession(rawToken);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", { ...getSessionCookieOptions(), maxAge: 0 });
  response.cookies.set(LOGIN_CHALLENGE_COOKIE_NAME, "", {
    ...getLoginChallengeCookieOptions(),
    maxAge: 0,
  });
  return response;
}
