import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBody, serverError } from "@/lib/apiHelpers";
import { enforceSameOrigin, getRequestMeta, requireSession } from "@/lib/apiAuth";
import { changeOwnPassword, UserAdminError } from "@/lib/userAdmin";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(512),
  newPassword: z.string().min(1).max(512),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const body = await parseJsonBody(request, changePasswordSchema);
  if (!body.ok) return body.response;

  try {
    await changeOwnPassword(
      { id: auth.session.user.id, email: auth.session.user.email, ipAddress: getRequestMeta(request).ipAddress },
      auth.session.sessionId,
      body.data.currentPassword,
      body.data.newPassword
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UserAdminError) return jsonError(err.message, err.status);
    return serverError(err, "Could not change your password.");
  }
}
