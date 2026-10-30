import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { dateIdSchema, jsonError, parseJsonBody, serverError, timeSchema } from "@/lib/apiHelpers";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { formatFullDay, parseLocalId } from "@/lib/dateUtils";
import { getRosterById, saveRosterEntry } from "@/lib/rosters";

const rosterUpsertSchema = z.object({
  date: dateIdSchema,
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

  const body = await parseJsonBody(req, rosterUpsertSchema);
  if (!body.ok) return body.response;
  const { date, hoursStart, hoursEnd } = body.data;
  const parsedDate = parseLocalId(date);
  if (!parsedDate) return jsonError("Invalid date", 400);
  if (hoursStart && hoursEnd && hoursStart >= hoursEnd) return jsonError("Invalid hours range", 400);

  const employees = body.data.employees ?? [];
  const tasks = body.data.tasks ?? [];

  try {
    const saved = await saveRosterEntry({
      id: date,
      title: formatFullDay(parsedDate),
      start: parsedDate,
      end: parsedDate,
      status: "Draft",
      updated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      employees,
      tasks,
      hoursStart,
      hoursEnd,
      tours: tasks.filter((task) => String((task as { type?: unknown })?.type).toLowerCase() === "tour").length,
      people: employees.length,
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
    return serverError(err, "Could not save the roster.");
  }
}

export async function GET(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const date = new URL(req.url).searchParams.get("date");
  if (!date || !parseLocalId(date)) return jsonError("Invalid date", 400);

  try {
    const roster = await getRosterById(date);
    if (!roster) return jsonError("Not found", 404);
    return NextResponse.json(roster);
  } catch (err) {
    return serverError(err);
  }
}
