import { prisma } from "@/lib/prisma";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { z } from "zod";

const createEmployeeSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function GET() {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const data = await prisma.employee.findMany({ orderBy: { id: "asc" } });
  return Response.json(data);
}

export async function POST(request: Request) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const parsed = createEmployeeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const created = await prisma.employee.create({ data: { name: parsed.data.name } });
  return Response.json(created);
}
