import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { jsonError, parseJsonBody, serverError, timeSchema } from "@/lib/apiHelpers";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { DAY_KEYS } from "@/lib/settingsDefaults";
import {
  addTaskTemplate,
  deleteTaskTemplate,
  getTaskTemplateById,
  getTaskTemplates,
  updateTaskTemplate,
} from "@/lib/taskTemplatesStore";

const dayKeySet = new Set<string>(DAY_KEYS);
const timeOrEmptySchema = z.union([z.literal(""), timeSchema]);
const boundedNumberSchema = z.coerce.number().int().min(0).max(10000);

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  category: z.string().trim().max(120).optional(),
  color: z.string().trim().max(32).optional(),
});

const updateTemplateSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().trim().max(120).optional(),
  color: z.string().trim().max(32).optional(),
  mustManned: z.boolean().optional(),
  overwriteExistingTasks: z.boolean().optional(),
  attendedByAll: z.boolean().optional(),
  autogenStart: timeOrEmptySchema.optional(),
  autogenEnd: timeOrEmptySchema.optional(),
  regularDays: z.array(z.enum(DAY_KEYS)).max(7).optional(),
  regularTimes: z.array(timeSchema).max(96).optional(),
  regularTimesByDay: z.record(z.array(timeSchema).max(96)).optional(),
  regularDayWindows: z
    .record(z.object({ start: timeOrEmptySchema.optional(), end: timeOrEmptySchema.optional() }))
    .optional(),
  extraDayWindows: z
    .record(z.array(z.object({ start: timeOrEmptySchema.optional(), end: timeOrEmptySchema.optional() })).max(24))
    .optional(),
  minPerEmployeePerDay: boundedNumberSchema.optional(),
  maxPerEmployeePerDay: boundedNumberSchema.optional(),
  durationMinutes: boundedNumberSchema.optional(),
  maxConsecutiveMinutes: boundedNumberSchema.optional(),
  waitingMinutes: boundedNumberSchema.optional(),
  packingMinutes: boundedNumberSchema.optional(),
  limitPerDay: boundedNumberSchema.optional(),
  maxConcurrentPerTimeslot: boundedNumberSchema.optional(),
  schoolTourImportTarget: z.boolean().optional(),
  waitingCanBeCovered: z.boolean().optional(),
  pairedWithTaskId: z.string().max(200).optional(),
  pairedPosition: z.enum(["before", "after"]).optional(),
  enabled: z.boolean().optional(),
});

/** Drops entries whose keys aren't weekday keys. */
function filterDayKeyedRecord<T>(input: Record<string, T> | undefined) {
  if (!input) return undefined;
  return Object.fromEntries(Object.entries(input).filter(([day]) => dayKeySet.has(day)));
}

function revalidateTemplates() {
  revalidateTag(CACHE_TAGS.tasks, "max");
  revalidatePath("/editor");
  revalidatePath("/tasks");
}

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json(await getTaskTemplates());
    const template = await getTaskTemplateById(id);
    return template ? NextResponse.json(template) : jsonError("Not found", 404);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const body = await parseJsonBody(request, createTemplateSchema);
  if (!body.ok) return body.response;

  try {
    const created = await addTaskTemplate(body.data);
    revalidateTemplates();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return serverError(err, "Could not add the task.");
  }
}

export async function PUT(request: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const body = await parseJsonBody(request, updateTemplateSchema);
  if (!body.ok) return body.response;
  const { id, regularTimesByDay, regularDayWindows, extraDayWindows, ...fields } = body.data;

  try {
    const updated = await updateTaskTemplate(id, {
      ...fields,
      regularTimesByDay: filterDayKeyedRecord(regularTimesByDay),
      regularDayWindows: filterDayKeyedRecord(regularDayWindows),
      extraDayWindows: filterDayKeyedRecord(extraDayWindows),
    });
    if (!updated) return jsonError("Template not found", 404);
    revalidateTemplates();
    return NextResponse.json(updated);
  } catch (err) {
    return serverError(err, "Could not save the task.");
  }
}

export async function DELETE(request: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("id is required", 400);

  try {
    const deleted = await deleteTaskTemplate(id);
    if (!deleted) return jsonError("Template not found", 404);
    revalidateTemplates();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Could not delete the task.");
  }
}
