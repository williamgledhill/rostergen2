import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { deleteSchoolTour, getSchoolTours, upsertSchoolTour } from "@/lib/schoolTours";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const tourSchema = z.object({
  id: z.string().trim().min(1).max(120).optional(),
  rosterDateId: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: timeSchema,
  schoolName: z.string().trim().min(1).max(200),
  studentCount: z.coerce.number().int().min(0).max(10000),
});

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  return NextResponse.json(await getSchoolTours());
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  try {
    const parsed = tourSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    const saved = await upsertSchoolTour(parsed.data);
    return NextResponse.json(saved, { status: parsed.data.id ? 200 : 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to save tour" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const deleted = await deleteSchoolTour(id);
  if (!deleted) return NextResponse.json({ error: "Tour not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
