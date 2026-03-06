import { prisma } from "@/lib/prisma";

export async function GET() {
  const data = await prisma.employee.findMany({ orderBy: { id: "asc" } });
  return Response.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const created = await prisma.employee.create({ data: { name: body.name } });
  return Response.json(created);
}
