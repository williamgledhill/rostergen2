import { NextResponse } from "next/server";
import { serverError } from "@/lib/apiHelpers";
import { requireSession } from "@/lib/apiAuth";
import { listUsers } from "@/lib/userAdmin";

export async function GET() {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({ users: await listUsers() });
  } catch (err) {
    return serverError(err, "Could not load users.");
  }
}
