import { NextResponse } from "next/server";
import { beginTotpSetup } from "@/lib/auth";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const setup = await beginTotpSetup(auth.session.user.id, auth.session.user.email);
  return NextResponse.json(setup);
}
