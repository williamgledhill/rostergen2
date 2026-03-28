import { NextResponse } from "next/server";
import { getRostersForMonth } from "@/lib/rosters";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";

function parseMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [yStr, mStr] = month.split("-");
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex)) return null;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return { year, monthIndex };
}

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  try {
    const body = await req.json();
    const month = typeof body?.month === "string" ? body.month : null;
    if (!month) return NextResponse.json({ error: "Missing month" }, { status: 400 });
    const parsed = parseMonth(month);
    if (!parsed) return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    return NextResponse.json({ created: 0 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    if (!month) return NextResponse.json({ error: "Missing month" }, { status: 400 });
    if (!parseMonth(month)) return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    const rosters = await getRostersForMonth(month, 5000);
    return NextResponse.json(rosters);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
