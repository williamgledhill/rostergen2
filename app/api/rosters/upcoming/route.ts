import { NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { getUpcomingRosters } from "@/lib/rosters";
import { getSettings } from "@/lib/settings";

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const settings = await getSettings();
  const rosters = await getUpcomingRosters(settings.upcomingDays);
  return NextResponse.json({ settings, rosters });
}
