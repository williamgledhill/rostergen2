import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rosterId = searchParams.get("rosterId");
  const data = await prisma.task.findMany({
    where: rosterId ? { rosterId: Number(rosterId) } : undefined,
    orderBy: { start: "asc" }
  });
  return Response.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const created = await prisma.task.create({
    data: {
      type: body.type,
      label: body.label,
      start: new Date(body.start),
      end: new Date(body.end),
      rosterId: Number(body.rosterId),
      employeeId: Number(body.employeeId),
    },
  });
  return Response.json(created);
}
