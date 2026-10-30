import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, serverError } from "@/lib/apiHelpers";
import { requireSession } from "@/lib/apiAuth";
import { invitationEmail, isEmailConfigured, sendEmail } from "@/lib/email";
import { buildAppUrl } from "@/lib/requestOrigin";
import { inviteUser, listUsers } from "@/lib/userAdmin";
import { runAdminAction } from "@/lib/userAdminRoute";

const inviteUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  role: z.enum(["ADMIN", "EDITOR"]),
  sendEmail: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({ users: await listUsers(), emailEnabled: isEmailConfigured() });
  } catch (err) {
    return serverError(err, "Could not load users.");
  }
}

/**
 * Creates an account and emails the invitation when email is set up (and not
 * turned off for this one); otherwise returns the link to send by hand.
 */
export async function POST(request: Request) {
  return runAdminAction(request, "Could not add the user.", async (actor) => {
    const body = await parseJsonBody(request, inviteUserSchema);
    if (!body.ok) return body.response;

    const { token, expiresAt } = await inviteUser(actor, body.data);
    const inviteUrl = buildAppUrl(request.url, "/signup/reset");
    inviteUrl.searchParams.set("token", token);

    if (isEmailConfigured() && body.data.sendEmail !== false) {
      const email = body.data.email.trim().toLowerCase();
      try {
        await sendEmail({
          to: email,
          ...invitationEmail({ name: body.data.name.trim(), invitedBy: actor.name || actor.email, url: inviteUrl.toString() }),
        });
        return NextResponse.json({ emailed: true, sentTo: email }, { status: 201 });
      } catch {
        // The account exists either way; fall back to a link the admin can send.
        return NextResponse.json(
          { emailed: false, emailFailed: true, inviteUrl: inviteUrl.toString(), expiresAt: expiresAt.toISOString() },
          { status: 201 }
        );
      }
    }

    return NextResponse.json({ inviteUrl: inviteUrl.toString(), expiresAt: expiresAt.toISOString() }, { status: 201 });
  });
}
