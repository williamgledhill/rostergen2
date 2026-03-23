import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/settings";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { z } from "zod";
import { DAY_KEYS } from "@/lib/settingsDefaults";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dayHoursSchema = z.object({ start: timeSchema, end: timeSchema });
const settingsSchema = z.object({
  hoursByDay: z.object(
    DAY_KEYS.reduce(
      (shape, day) => ({ ...shape, [day]: dayHoursSchema }),
      {} as Record<(typeof DAY_KEYS)[number], typeof dayHoursSchema>
    )
  ),
  upcomingDays: z.coerce.number().int().min(1).max(90),
});

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(getSettings());
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  try {
    const parsed = settingsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const saved = saveSettings(parsed.data);
    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save settings" }, { status: 500 });
  }
}
