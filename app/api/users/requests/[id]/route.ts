import { NextResponse } from "next/server";
import { jsonError } from "@/lib/apiHelpers";
import { approveAccountRequest, rejectAccountRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/userAdmin";
import { runAdminAction } from "@/lib/userAdminRoute";

type RouteContext = { params: Promise<{ id: string }> };

/** Approves the request: the account becomes an active editor. */
export async function POST(request: Request, { params }: RouteContext) {
  return runAdminAction(request, "Could not approve the request.", async (actor) => {
    const { id } = await params;
    const user = await approveAccountRequest(id);
    if (!user) return jsonError("Request not found", 404);
    await recordAudit(prisma, actor, "user.request_approved", { id, email: user.email });
    return NextResponse.json({ ok: true });
  });
}

/** Rejects the request and removes the account. */
export async function DELETE(request: Request, { params }: RouteContext) {
  return runAdminAction(request, "Could not reject the request.", async (actor) => {
    const { id } = await params;
    const user = await rejectAccountRequest(id);
    if (!user) return jsonError("Request not found", 404);
    await recordAudit(prisma, actor, "user.request_rejected", { id, email: user.email });
    return NextResponse.json({ ok: true });
  });
}
