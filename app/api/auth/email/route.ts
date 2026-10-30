import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBody, serverError } from "@/lib/apiHelpers";
import { enforceSameOrigin, getRequestMeta, requireSession } from "@/lib/apiAuth";
import { changeOwnEmail, UserAdminError } from "@/lib/userAdmin";

const changeEmailSchema = z.object({
  currentPassword: z.string().min(1).max(512),
  newEmail: z.string().trim().email().max(320),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const body = await parseJsonBody(request, changeEmailSchema);
  if (!body.ok) return body.response;

  try {
    const email = await changeOwnEmail(
      { id: auth.session.user.id, email: auth.session.user.email, ipAddress: getRequestMeta(request).ipAddress },
      body.data.currentPassword,
      body.data.newEmail
    );
    return NextResponse.json({ email });
  } catch (err) {
    if (err instanceof UserAdminError) return jsonError(err.message, err.status);
    return serverError(err, "Could not change your email.");
  }
}
