import { prisma } from "@/lib/prisma";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { z } from "zod";

const createTaskSchema = z.object({
  type: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(200),
  start: z.string().min(1),
  end: z.string().min(1),
  rosterId: z.coerce.number().int().positive(),
  employeeId: z.coerce.number().int().positive(),
});

export async function GET(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const rosterIdParam = searchParams.get("rosterId");
  let rosterId: number | undefined;
  if (rosterIdParam !== null) {
    const parsedId = Number(rosterIdParam);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return Response.json({ error: "Invalid rosterId" }, { status: 400 });
    }
    rosterId = parsedId;
  }

  const data = await prisma.task.findMany({
    where: typeof rosterId === "number" ? { rosterId } : undefined,
    orderBy: { start: "asc" },
  });
  return Response.json(data);
}

export async function POST(request: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const parsed = createTaskSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const start = new Date(parsed.data.start);
  const end = new Date(parsed.data.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return Response.json({ error: "Invalid start/end range" }, { status: 400 });
  }

  const created = await prisma.task.create({
    data: {
      type: parsed.data.type,
      label: parsed.data.label,
      start,
      end,
      rosterId: parsed.data.rosterId,
      employeeId: parsed.data.employeeId,
    },
  });
  return Response.json(created);
}
