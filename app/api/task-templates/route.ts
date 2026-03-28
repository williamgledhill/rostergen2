import { NextResponse } from "next/server";
import { addTaskTemplate, deleteTaskTemplate, getTaskTemplates, updateTaskTemplate } from "@/lib/taskTemplatesStore";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { z } from "zod";

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const dayKeySet = new Set<string>(DAY_KEYS);
const dayKeySchema = z.enum(DAY_KEYS);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
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
  autogenStart: timeOrEmptySchema.optional(),
  autogenEnd: timeOrEmptySchema.optional(),
  regularDays: z.array(dayKeySchema).max(7).optional(),
  regularTimes: z.array(timeSchema).max(96).optional(),
  regularTimesByDay: z.record(z.array(timeSchema).max(96)).optional(),
  regularDayWindows: z
    .record(
      z.object({
        start: timeOrEmptySchema.optional(),
        end: timeOrEmptySchema.optional(),
      })
    )
    .optional(),
  minPerEmployeePerDay: boundedNumberSchema.optional(),
  maxPerEmployeePerDay: boundedNumberSchema.optional(),
  durationMinutes: boundedNumberSchema.optional(),
  maxConsecutiveMinutes: boundedNumberSchema.optional(),
  waitingMinutes: boundedNumberSchema.optional(),
  packingMinutes: boundedNumberSchema.optional(),
  limitPerDay: boundedNumberSchema.optional(),
  enabled: z.boolean().optional(),
});

function filterDayKeyedRecord<T>(input: Record<string, T> | undefined) {
  if (!input) return undefined;
  return Object.fromEntries(Object.entries(input).filter(([day]) => dayKeySet.has(day)));
}

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const templates = await getTaskTemplates();
  if (id) {
    const match = templates.find((t) => t.id === id);
    if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(match);
  }
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  try {
    const parsed = createTemplateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const created = await addTaskTemplate({
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category,
      color: parsed.data.color,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to add template" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  try {
    const parsed = updateTemplateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const id = parsed.data.id;
    const payload = {
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category,
      color: parsed.data.color,
      mustManned: parsed.data.mustManned,
      autogenStart: parsed.data.autogenStart,
      autogenEnd: parsed.data.autogenEnd,
      regularDays: parsed.data.regularDays,
      regularTimes: parsed.data.regularTimes,
      regularTimesByDay: filterDayKeyedRecord(parsed.data.regularTimesByDay),
      regularDayWindows: filterDayKeyedRecord(parsed.data.regularDayWindows),
      minPerEmployeePerDay: parsed.data.minPerEmployeePerDay,
      maxPerEmployeePerDay: parsed.data.maxPerEmployeePerDay,
      durationMinutes: parsed.data.durationMinutes,
      maxConsecutiveMinutes: parsed.data.maxConsecutiveMinutes,
      waitingMinutes: parsed.data.waitingMinutes,
      packingMinutes: parsed.data.packingMinutes,
      limitPerDay: parsed.data.limitPerDay,
      enabled: parsed.data.enabled,
    };
    const updated = await updateTaskTemplate(id, payload);
    if (!updated) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const deleted = await deleteTaskTemplate(id);
    if (!deleted) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete template" }, { status: 500 });
  }
}
