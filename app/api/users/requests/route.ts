import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiHelpers";
import { requireSession } from "@/lib/apiAuth";
import { listAccountRequests } from "@/lib/auth";

export async function GET() {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({ requests: await listAccountRequests() });
  } catch (err) {
    return serverError(err, "Could not load account requests.");
  }
}
