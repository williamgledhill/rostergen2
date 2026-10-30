import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, parseJsonBody, serverError } from "@/lib/apiHelpers";
import { enforceSameOrigin } from "@/lib/apiAuth";
import { requestAccount } from "@/lib/auth";
import { validatePasswordStrength } from "@/lib/password";

const signupRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(512),
});

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const body = await parseJsonBody(request, signupRequestSchema);
  if (!body.ok) return body.response;

  if (!validatePasswordStrength(body.data.password)) {
    return jsonError("Use a password of at least 12 characters.", 400);
  }

  try {
    await requestAccount(body.data);
    // The same answer whether or not the email was already registered.
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Could not send your request. Please try again.");
  }
}
