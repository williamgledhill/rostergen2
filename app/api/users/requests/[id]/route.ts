import { NextResponse } from "next/server";
import { jsonError, serverError } from "@/lib/apiHelpers";
import { enforceSameOrigin, requireSession } from "@/lib/apiAuth";
import { approveAccountRequest, rejectAccountRequest } from "@/lib/auth";

type RouteContext = { params: Promise<{ id: string }> };

/** Approves the request: the account becomes an active editor. */
export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  try {
    const approved = await approveAccountRequest((await params).id);
    if (!approved) return jsonError("Request not found", 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Could not approve the request.");
  }
}

/** Rejects the request and removes the account. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  try {
    const rejected = await rejectAccountRequest((await params).id);
    if (!rejected) return jsonError("Request not found", 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError(err, "Could not reject the request.");
  }
}
