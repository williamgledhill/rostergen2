import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { dateIdSchema, jsonError, parseJsonBody, serverError, timeSchema } from "@/lib/apiHelpers";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { ALL_DAYS, type WeeklySchedule } from "@/lib/people";
import { deletePerson, getPeople, getPerson, upsertPerson } from "@/lib/peopleStore";

const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  start: timeSchema,
  end: timeSchema,
});
const weeklyScheduleSchema = z.object(
  Object.fromEntries(ALL_DAYS.map((day) => [day, dayScheduleSchema])) as Record<
    (typeof ALL_DAYS)[number],
    typeof dayScheduleSchema
  >
);
const personPayloadSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  email: z.union([z.literal(""), z.string().email().max(320)]).optional(),
  schedule: weeklyScheduleSchema,
  fortnight: z
    .object({
      anchorDate: dateIdSchema,
      weekA: weeklyScheduleSchema,
      weekB: weeklyScheduleSchema,
    })
    .optional(),
});

function revalidatePeople() {
  revalidateTag(CACHE_TAGS.people, "max");
  revalidatePath("/editor");
  revalidatePath("/people");
}

export async function GET(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json(await getPeople());
    const person = await getPerson(id);
    return person ? NextResponse.json(person) : jsonError("Not found", 404);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(req: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  const body = await parseJsonBody(req, personPayloadSchema);
  if (!body.ok) return body.response;
  const { id, name, email, schedule, fortnight } = body.data;

  try {
    const person = await upsertPerson({
      id,
      name,
      email,
      schedule: schedule as WeeklySchedule,
      fortnight: fortnight
        ? {
            anchorDate: fortnight.anchorDate,
            weekA: fortnight.weekA as WeeklySchedule,
            weekB: fortnight.weekB as WeeklySchedule,
          }
        : undefined,
    });
    revalidatePeople();
    return NextResponse.json(person);
  } catch (err) {
    return serverError(err, "Could not save this person.");
  }
}

export async function DELETE(req: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("Missing id", 400);

  try {
    await deletePerson(id);
    revalidatePeople();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Could not delete this person.");
  }
}
