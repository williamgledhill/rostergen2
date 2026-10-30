import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiHelpers";
import { requireSession } from "@/lib/apiAuth";
import { listAuditLog } from "@/lib/userAdmin";

export async function GET() {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({ entries: await listAuditLog() });
  } catch (err) {
    return serverError(err, "Could not load the activity log.");
  }
}
