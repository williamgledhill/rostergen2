import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/apiHelpers";
import { completeTwoFactorLogin } from "@/lib/auth";
import { enforceSameOrigin, getRequestMeta } from "@/lib/apiAuth";
import {
  getLoginChallengeCookieOptions,
  getSessionCookieOptions,
  LOGIN_CHALLENGE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/sessionToken";

const verifySchema = z.object({
  code: z.string().trim().min(6).max(32),
});

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const cookieStore = await cookies();
  const challengeToken = cookieStore.get(LOGIN_CHALLENGE_COOKIE_NAME)?.value;
  if (!challengeToken) {
    return NextResponse.json({ error: "Two-factor challenge missing" }, { status: 401 });
  }

  const body = await parseJsonBody(request, verifySchema);
  if (!body.ok) return body.response;

  const result = await completeTwoFactorLogin(challengeToken, body.data.code, getRequestMeta(request));
  if (!result) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 401 });
  }

  const response = NextResponse.json({
    session: {
      user: result.user,
    },
  });
  response.cookies.set(SESSION_COOKIE_NAME, result.sessionToken, getSessionCookieOptions());
  response.cookies.set(LOGIN_CHALLENGE_COOKIE_NAME, "", {
    ...getLoginChallengeCookieOptions(),
    maxAge: 0,
  });
  return response;
}
