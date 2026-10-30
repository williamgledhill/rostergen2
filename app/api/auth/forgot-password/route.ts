import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/apiHelpers";
import { enforceSameOrigin } from "@/lib/apiAuth";
import { isEmailConfigured, passwordResetEmail, sendEmail } from "@/lib/email";
import { buildAppUrl } from "@/lib/requestOrigin";
import { requestPasswordResetByEmail } from "@/lib/userAdmin";

const forgotPasswordSchema = z.object({ email: z.string().trim().email().max(320) });

/** Whether the sign-in page should offer "Forgot password?". */
export async function GET() {
  return NextResponse.json({ enabled: isEmailConfigured() });
}

/**
 * Emails a reset link if the address belongs to an active account. Always
 * gives the same answer, so it can't be used to find out who has an account.
 */
export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const body = await parseJsonBody(request, forgotPasswordSchema);
  if (!body.ok) return body.response;

  if (isEmailConfigured()) {
    try {
      const link = await requestPasswordResetByEmail(body.data.email);
      if (link) {
        const url = buildAppUrl(request.url, "/signup/reset");
        url.searchParams.set("token", link.token);
        await sendEmail({ to: link.email, ...passwordResetEmail({ name: link.name, url: url.toString(), requestedByUser: true }) });
      }
    } catch (err) {
      // Logged for the operator; the person sees the usual answer.
      console.error("Forgot-password email failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}
