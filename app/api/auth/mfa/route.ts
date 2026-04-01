import { NextResponse } from "next/server";
import { getMfaStatus } from "@/lib/auth";
import { requireSession } from "@/lib/apiAuth";

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  return NextResponse.json(await getMfaStatus(auth.session.user.id));
}
