import { NextResponse } from "next/server";
import { issuePasswordReset } from "@/lib/userAdmin";
import { runAdminAction } from "@/lib/userAdminRoute";

type RouteContext = { params: Promise<{ id: string }> };

/** Returns a single-use link (an invitation if they have never signed in) to pass on to the user. */
export async function POST(request: Request, { params }: RouteContext) {
  return runAdminAction(request, "Could not create a reset link.", async (actor) => {
    const { token, expiresAt, invitation } = await issuePasswordReset(actor, (await params).id);
    const resetUrl = new URL("/signup/reset", request.url);
    resetUrl.searchParams.set("token", token);
    return NextResponse.json({ resetUrl: resetUrl.toString(), expiresAt: expiresAt.toISOString(), invitation });
  });
}
