import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/apiHelpers";
import { disableTotp } from "@/lib/auth";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";

const disableSchema = z.object({
  password: z.string().min(1).max(512),
  code: z.string().trim().min(6).max(32),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const body = await parseJsonBody(request, disableSchema);
  if (!body.ok) return body.response;

  const disabled = await disableTotp(auth.session.user.id, body.data.password, body.data.code);
  if (!disabled) {
    return NextResponse.json({ error: "Password or verification code is invalid" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
