import { NextResponse } from "next/server";
import { addTaskTemplate, deleteTaskTemplate, getTaskTemplates, updateTaskTemplate } from "@/lib/taskTemplatesStore";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const templates = getTaskTemplates();
  if (id) {
    const match = templates.find((t) => t.id === id);
    if (!match) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(match);
  }
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description = typeof body?.description === "string" ? body.description : "";
    const category = typeof body?.category === "string" ? body.category : "";
    const color = typeof body?.color === "string" ? body.color : "";
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const created = addTaskTemplate({ name, description, category, color });
    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to add template" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const regularDays = Array.isArray(body?.regularDays)
      ? body.regularDays.filter((d: unknown) => typeof d === "string")
      : undefined;
    const regularTimes = Array.isArray(body?.regularTimes)
      ? body.regularTimes.filter((t: unknown) => typeof t === "string")
      : undefined;
    const regularTimesByDay =
      body?.regularTimesByDay && typeof body.regularTimesByDay === "object" && !Array.isArray(body.regularTimesByDay)
        ? body.regularTimesByDay
        : undefined;
    const regularDayWindows =
      body?.regularDayWindows && typeof body.regularDayWindows === "object" && !Array.isArray(body.regularDayWindows)
        ? body.regularDayWindows
        : undefined;
    const payload = {
      name: typeof body?.name === "string" ? body.name.trim() : undefined,
      description: typeof body?.description === "string" ? body.description : undefined,
      category: typeof body?.category === "string" ? body.category : undefined,
      color: typeof body?.color === "string" ? body.color : undefined,
      mustManned: typeof body?.mustManned === "boolean" ? body.mustManned : undefined,
      autogenStart: typeof body?.autogenStart === "string" ? body.autogenStart : undefined,
      autogenEnd: typeof body?.autogenEnd === "string" ? body.autogenEnd : undefined,
      regularDays,
      regularTimes,
      regularTimesByDay,
      regularDayWindows,
      minPerEmployeePerDay: Number.isFinite(body?.minPerEmployeePerDay)
        ? Number(body.minPerEmployeePerDay)
        : undefined,
      maxPerEmployeePerDay: Number.isFinite(body?.maxPerEmployeePerDay)
        ? Number(body.maxPerEmployeePerDay)
        : undefined,
      durationMinutes: Number.isFinite(body?.durationMinutes)
        ? Number(body.durationMinutes)
        : undefined,
      maxConsecutiveMinutes: Number.isFinite(body?.maxConsecutiveMinutes)
        ? Number(body.maxConsecutiveMinutes)
        : undefined,
      waitingMinutes: Number.isFinite(body?.waitingMinutes)
        ? Number(body.waitingMinutes)
        : undefined,
      packingMinutes: Number.isFinite(body?.packingMinutes)
        ? Number(body.packingMinutes)
        : undefined,
      limitPerDay: Number.isFinite(body?.limitPerDay)
        ? Number(body.limitPerDay)
        : undefined,
      enabled: typeof body?.enabled === "boolean" ? body.enabled : undefined,
    };
    const updated = updateTaskTemplate(id, payload);
    if (!updated) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const deleted = deleteTaskTemplate(id);
    if (!deleted) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete template" }, { status: 500 });
  }
}
