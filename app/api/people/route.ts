import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { getPeople, getPerson } = await import("../../../lib/peopleStore");
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const person = getPerson(id);
    if (!person) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(person);
  }
  return NextResponse.json(getPeople());
}

export async function POST(req: Request) {
  try {
    const { upsertPerson } = await import("../../../lib/peopleStore");
    const body = await req.json();
    if (!body || typeof body.id !== "string" || typeof body.name !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const person = upsertPerson(body);
    return NextResponse.json(person);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { deletePerson } = await import("../../../lib/peopleStore");
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    deletePerson(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
