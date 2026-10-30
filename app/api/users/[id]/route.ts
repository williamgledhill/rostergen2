import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/apiHelpers";
import { changeUserRole, setUserActive } from "@/lib/userAdmin";
import { runAdminAction } from "@/lib/userAdminRoute";

type RouteContext = { params: Promise<{ id: string }> };

const updateUserSchema = z.union([
  z.object({ role: z.enum(["ADMIN", "EDITOR"]) }).strict(),
  z.object({ isActive: z.boolean() }).strict(),
]);

/** Changes one thing at a time: the role, or whether the account is active. */
export async function PATCH(request: Request, { params }: RouteContext) {
  return runAdminAction(request, "Could not update the user.", async (actor) => {
    const body = await parseJsonBody(request, updateUserSchema);
    if (!body.ok) return body.response;

    const { id } = await params;
    if ("role" in body.data) await changeUserRole(actor, id, body.data.role);
    else await setUserActive(actor, id, body.data.isActive);
    return NextResponse.json({ ok: true });
  });
}
