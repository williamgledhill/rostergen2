import { NextResponse } from "next/server";
import { jsonError, serverError } from "@/lib/apiHelpers";
import { requireSession } from "@/lib/apiAuth";
import { getRostersForMonth } from "@/lib/rosters";

export async function GET(req: Request) {
  const auth = await requireSession();
  if (!auth.ok) return auth.response;

  const month = new URL(req.url).searchParams.get("month");
  const monthNumber = Number(month?.slice(5));
  if (!month || !/^\d{4}-\d{2}$/.test(month) || monthNumber < 1 || monthNumber > 12) {
    return jsonError("Invalid month", 400);
  }

  try {
    return NextResponse.json(await getRostersForMonth(month, 5000));
  } catch (err) {
    return serverError(err);
  }
}
