import { NextResponse } from "next/server";
import { jsonError, serverError } from "@/lib/apiHelpers";
import { enforceSameOrigin, getRequestMeta, requireSession } from "@/lib/apiAuth";
import { EmailError } from "@/lib/email";
import { UserAdminError, type Actor } from "@/lib/userAdmin";

/**
 * Runs an administrator action: checks the session and origin, then turns
 * UserAdminError into a readable response and anything else into a 500.
 */
export async function runAdminAction(
  request: Request,
  failureMessage: string,
  action: (actor: Actor) => Promise<NextResponse>
) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const actor: Actor = {
    id: auth.session.user.id,
    email: auth.session.user.email,
    name: auth.session.user.name,
    ipAddress: getRequestMeta(request).ipAddress,
  };

  try {
    return await action(actor);
  } catch (err) {
    if (err instanceof UserAdminError) return jsonError(err.message, err.status);
    if (err instanceof EmailError) return jsonError(err.message, 502);
    return serverError(err, failureMessage);
  }
}
