import { NextResponse } from "next/server";
import { resetUserTwoFactor } from "@/lib/userAdmin";
import { runAdminAction } from "@/lib/userAdminRoute";

type RouteContext = { params: Promise<{ id: string }> };

/** Turns off two-factor for someone who has lost their authenticator. */
export async function DELETE(request: Request, { params }: RouteContext) {
  return runAdminAction(request, "Could not reset two-factor authentication.", async (actor) => {
    await resetUserTwoFactor(actor, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
