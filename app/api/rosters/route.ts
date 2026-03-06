import { NextResponse } from "next/server";
import { saveRosterEntry, getRosterById, loadSavedRosters } from "@/lib/rosters";
import { parseLocalId, formatFullDay } from "@/lib/dateUtils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const date = typeof body?.date === "string" ? body.date : null;
    if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });
    const parsed = parseLocalId(date);
    if (!parsed) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

    const employees = Array.isArray(body?.employees) ? body.employees : [];
    const tasks = Array.isArray(body?.tasks) ? body.tasks : [];
    const hoursStart = typeof body?.hoursStart === "string" ? body.hoursStart : undefined;
    const hoursEnd = typeof body?.hoursEnd === "string" ? body.hoursEnd : undefined;

    const existing = getRosterById(date);

    const tours = tasks.filter((t: any) => String(t.type).toLowerCase() === "tour").length;
    const people = employees.length;

    saveRosterEntry({
      ...(existing || {
        id: date,
        title: formatFullDay(parsed),
        start: parsed,
        end: parsed,
        status: "Draft",
        updated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      }),
      employees,
      tasks,
      hoursStart,
      hoursEnd,
      tours,
      people,
      updated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });
    const parsed = parseLocalId(date);
    if (!parsed) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    const roster = getRosterById(date);
    if (!roster) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(roster);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
