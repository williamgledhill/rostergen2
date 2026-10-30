import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { parseJsonBody, serverError, timeSchema } from "@/lib/apiHelpers";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { getSettings, saveSettings } from "@/lib/settings";
import { DAY_KEYS } from "@/lib/settingsDefaults";

const dayHoursSchema = z.object({ start: timeSchema, end: timeSchema });
const settingsSchema = z.object({
  hoursByDay: z.object(
    Object.fromEntries(DAY_KEYS.map((day) => [day, dayHoursSchema])) as Record<
      (typeof DAY_KEYS)[number],
      typeof dayHoursSchema
    >
  ),
  upcomingDays: z.coerce.number().int().min(1).max(90),
});

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(await getSettings());
  } catch (err) {
    return serverError(err, "Could not load settings.");
  }
}

export async function PUT(request: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const body = await parseJsonBody(request, settingsSchema);
  if (!body.ok) return body.response;

  try {
    const saved = await saveSettings(body.data);
    revalidateTag(CACHE_TAGS.settings, "max");
    revalidateTag(CACHE_TAGS.rosters, "max");
    revalidatePath("/editor");
    revalidatePath("/rosters");
    revalidatePath("/settings");
    return NextResponse.json(saved);
  } catch (err) {
    return serverError(err, "Could not save settings.");
  }
}
