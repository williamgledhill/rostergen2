import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, serverError } from "@/lib/apiHelpers";
import { requireSession } from "@/lib/apiAuth";
import { inviteUser, listUsers } from "@/lib/userAdmin";
import { runAdminAction } from "@/lib/userAdminRoute";

const inviteUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  role: z.enum(["ADMIN", "EDITOR"]),
});

export async function GET() {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json({ users: await listUsers() });
  } catch (err) {
    return serverError(err, "Could not load users.");
  }
}

/** Creates an account and returns the invitation link to send to the person. */
export async function POST(request: Request) {
  return runAdminAction(request, "Could not add the user.", async (actor) => {
    const body = await parseJsonBody(request, inviteUserSchema);
    if (!body.ok) return body.response;

    const { token, expiresAt } = await inviteUser(actor, body.data);
    const inviteUrl = new URL("/signup/reset", request.url);
    inviteUrl.searchParams.set("token", token);
    return NextResponse.json({ inviteUrl: inviteUrl.toString(), expiresAt: expiresAt.toISOString() }, { status: 201 });
  });
}
