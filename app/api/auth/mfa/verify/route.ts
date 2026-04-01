import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmTotpSetup } from "@/lib/auth";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";

const verifySchema = z.object({
  code: z.string().trim().min(6).max(32),
});

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const parsed = verifySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const recoveryCodes = await confirmTotpSetup(auth.session.user.id, parsed.data.code);
  if (!recoveryCodes) {
    return NextResponse.json({ error: "Invalid verification code" }, { status: 400 });
  }

  return NextResponse.json({ recoveryCodes });
}
