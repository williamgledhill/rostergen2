import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/apiHelpers";
import { changeUserRole, setUserActive, updateUserDetails } from "@/lib/userAdmin";
import { runAdminAction } from "@/lib/userAdminRoute";

type RouteContext = { params: Promise<{ id: string }> };

const updateUserSchema = z.union([
  z.object({ role: z.enum(["ADMIN", "EDITOR"]) }).strict(),
  z.object({ isActive: z.boolean() }).strict(),
  z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      email: z.string().trim().email().max(320).optional(),
    })
    .strict()
    .refine((value) => value.name !== undefined || value.email !== undefined),
]);

/** Changes one kind of thing at a time: the role, whether the account is active, or the name and email. */
export async function PATCH(request: Request, { params }: RouteContext) {
  return runAdminAction(request, "Could not update the user.", async (actor) => {
    const body = await parseJsonBody(request, updateUserSchema);
    if (!body.ok) return body.response;

    const { id } = await params;
    if ("role" in body.data) await changeUserRole(actor, id, body.data.role);
    else if ("isActive" in body.data) await setUserActive(actor, id, body.data.isActive);
    else await updateUserDetails(actor, id, body.data);
    return NextResponse.json({ ok: true });
  });
}
