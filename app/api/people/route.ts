import { NextResponse } from "next/server";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { ALL_DAYS } from "@/lib/people";
import { z } from "zod";
import type { Person } from "@/lib/people";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  start: timeSchema,
  end: timeSchema,
});
const weeklyScheduleSchema = z.object(
  ALL_DAYS.reduce(
    (shape, day) => ({ ...shape, [day]: dayScheduleSchema }),
    {} as Record<string, typeof dayScheduleSchema>
  )
);
const personPayloadSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  email: z.union([z.literal(""), z.string().email().max(320)]).optional(),
  schedule: weeklyScheduleSchema,
  fortnight: z
    .object({
      anchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      weekA: weeklyScheduleSchema,
      weekB: weeklyScheduleSchema,
    })
    .optional(),
});

export async function GET(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { getPeople, getPerson } = await import("../../../lib/peopleStore");
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const person = await getPerson(id);
    if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(person);
  }
  return NextResponse.json(await getPeople());
}

export async function POST(req: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  try {
    const { upsertPerson } = await import("../../../lib/peopleStore");
    const parsed = personPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const payload = parsed.data;
    const personToSave: Person = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      schedule: payload.schedule as Person["schedule"],
      fortnight: payload.fortnight
        ? {
            anchorDate: payload.fortnight.anchorDate,
            weekA: payload.fortnight.weekA as Person["schedule"],
            weekB: payload.fortnight.weekB as Person["schedule"],
          }
        : undefined,
    };
    const person = await upsertPerson(personToSave);
    return NextResponse.json(person);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(req);
  if (originError) return originError;

  try {
    const { deletePerson } = await import("../../../lib/peopleStore");
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deletePerson(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
