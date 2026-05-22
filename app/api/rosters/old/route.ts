import { NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { getOldSavedRosters } from "@/lib/rosters";

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const rosters = await getOldSavedRosters();
  return NextResponse.json(rosters);
}
