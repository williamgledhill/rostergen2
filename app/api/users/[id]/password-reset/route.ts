import { NextResponse } from "next/server";
import { z } from "zod";
import { invitationEmail, isEmailConfigured, passwordResetEmail, sendEmail } from "@/lib/email";
import { buildAppUrl } from "@/lib/requestOrigin";
import { issuePasswordReset } from "@/lib/userAdmin";
import { runAdminAction } from "@/lib/userAdminRoute";

type RouteContext = { params: Promise<{ id: string }> };

const deliverySchema = z.object({ delivery: z.enum(["email", "link"]).optional() });

/**
 * Creates a single-use link (an invitation if they have never signed in). It's
 * emailed to the user when email is set up; otherwise, or when asked for, the
 * link comes back for the administrator to pass on.
 */
export async function POST(request: Request, { params }: RouteContext) {
  return runAdminAction(request, "Could not create a reset link.", async (actor) => {
    const parsed = deliverySchema.safeParse(await request.json().catch(() => ({})));
    const delivery = parsed.success && parsed.data.delivery ? parsed.data.delivery : isEmailConfigured() ? "email" : "link";

    const link = await issuePasswordReset(actor, (await params).id);
    const url = buildAppUrl(request.url, "/signup/reset");
    url.searchParams.set("token", link.token);

    if (delivery === "email") {
      const message = link.invitation
        ? invitationEmail({ name: link.name, invitedBy: actor.name || actor.email, url: url.toString() })
        : passwordResetEmail({ name: link.name, url: url.toString(), requestedByUser: false });
      await sendEmail({ to: link.email, ...message });
      return NextResponse.json({ emailed: true, sentTo: link.email, invitation: link.invitation });
    }

    return NextResponse.json({ resetUrl: url.toString(), expiresAt: link.expiresAt.toISOString(), invitation: link.invitation });
  });
}
