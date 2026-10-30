import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBody, serverError } from "@/lib/apiHelpers";
import { enforceSameOrigin, getRequestMeta } from "@/lib/apiAuth";
import { completePasswordReset, describePasswordReset, UserAdminError } from "@/lib/userAdmin";

const completeResetSchema = z.object({
  token: z.string().min(1).max(200),
  password: z.string().min(1).max(512),
});

/** Checks a reset link before the user types a new password. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || token.length > 200) return jsonError("Invalid link", 400);

  try {
    const account = await describePasswordReset(token);
    if (!account) return jsonError("This link is invalid or has expired. Ask an administrator for a new one.", 404);
    return NextResponse.json({ account });
  } catch (err) {
    return serverError(err, "Could not check the reset link.");
  }
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const body = await parseJsonBody(request, completeResetSchema);
  if (!body.ok) return body.response;

  try {
    await completePasswordReset(body.data.token, body.data.password, getRequestMeta(request).ipAddress);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UserAdminError) return jsonError(err.message, err.status);
    return serverError(err, "Could not reset your password.");
  }
}
