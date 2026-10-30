import { NextResponse } from "next/server";
import { signOutUserEverywhere } from "@/lib/userAdmin";
import { runAdminAction } from "@/lib/userAdminRoute";

type RouteContext = { params: Promise<{ id: string }> };

/** Signs the user out on every device. */
export async function DELETE(request: Request, { params }: RouteContext) {
  return runAdminAction(request, "Could not sign the user out.", async (actor) => {
    await signOutUserEverywhere(actor, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
