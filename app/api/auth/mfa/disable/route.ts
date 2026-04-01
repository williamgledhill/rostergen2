import { NextResponse } from "next/server";
import { z } from "zod";
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

  const parsed = disableSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const disabled = await disableTotp(auth.session.user.id, parsed.data.password, parsed.data.code);
  if (!disabled) {
    return NextResponse.json({ error: "Password or verification code is invalid" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
