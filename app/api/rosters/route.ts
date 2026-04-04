import { NextResponse } from "next/server";
import { saveRosterEntry, getRosterById } from "@/lib/rosters";
import { parseLocalId, formatFullDay } from "@/lib/dateUtils";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const rosterUpsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employees: z.array(z.unknown()).max(500).optional(),
  tasks: z.array(z.unknown()).max(5000).optional(),
  hoursStart: timeSchema.optional(),
  hoursEnd: timeSchema.optional(),
});

export async function POST(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  try {
    const parsedBody = rosterUpsertSchema.safeParse(await req.json());
    if (!parsedBody.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const { date } = parsedBody.data;
    const parsed = parseLocalId(date);
    if (!parsed) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

    const employees = parsedBody.data.employees ?? [];
    const tasks = parsedBody.data.tasks ?? [];
    const hoursStart = parsedBody.data.hoursStart;
    const hoursEnd = parsedBody.data.hoursEnd;
    if (hoursStart && hoursEnd && hoursStart >= hoursEnd) {
      return NextResponse.json({ error: "Invalid hours range" }, { status: 400 });
    }

    const tours = tasks.filter((t: any) => String(t.type).toLowerCase() === "tour").length;
    const people = employees.length;

    const saved = await saveRosterEntry({
      id: date,
      title: formatFullDay(parsed),
      start: parsed,
      end: parsed,
      status: "Draft",
      updated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      employees,
      tasks,
      hoursStart,
      hoursEnd,
      tours,
      people,
    });

    revalidateTag(CACHE_TAGS.rosters, "max");
    revalidatePath("/editor");
    revalidatePath("/rosters");
    revalidatePath(`/rosters/months/${date.slice(0, 7)}`);

    return NextResponse.json({
      ok: true,
      savedAt: saved.updatedAt?.toISOString() ?? new Date().toISOString(),
      updatedLabel: saved.updated,
    });
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
    const date = searchParams.get("date");
    if (!date) return NextResponse.json({ error: "Missing date" }, { status: 400 });
    const parsed = parseLocalId(date);
    if (!parsed) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
    const roster = await getRosterById(date);
    if (!roster) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(roster);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
