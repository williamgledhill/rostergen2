import { NextResponse } from "next/server";
import { getAccounts } from "@/lib/auth";

export async function GET() {
  const accounts = getAccounts();
  return NextResponse.json(accounts);
}
