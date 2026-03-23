import { NextResponse } from "next/server";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { ALL_DAYS } from "@/lib/people";
import { z } from "zod";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  start: timeSchema,
  end: timeSchema,
});
const personPayloadSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  email: z.union([z.literal(""), z.string().email().max(320)]).optional(),
  schedule: z.object(
    ALL_DAYS.reduce(
      (shape, day) => ({ ...shape, [day]: dayScheduleSchema }),
      {} as Record<string, typeof dayScheduleSchema>
    )
  ),
});

export async function GET(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { getPeople, getPerson } = await import("../../../lib/peopleStore");
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const person = getPerson(id);
    if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(person);
  }
  return NextResponse.json(getPeople());
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
    const person = upsertPerson(parsed.data);
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
    deletePerson(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
