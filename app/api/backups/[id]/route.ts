import { NextResponse } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { jsonError, serverError } from "@/lib/apiHelpers";
import { deleteBackup, readBackup } from "@/lib/backups";
import { runAdminAction } from "@/lib/userAdminRoute";

type RouteContext = { params: Promise<{ id: string }> };

/** Downloads the backup as a JSON file. */
export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  try {
    const backup = await readBackup((await params).id);
    if (!backup) return jsonError("Backup not found", 404);
    const stamp = backup.item.createdAt.slice(0, 16).replace(/[T:]/g, "-");
    return new NextResponse(JSON.stringify(backup.data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="roster-backup-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return serverError(err, "Could not read this backup.");
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  return runAdminAction(request, "Could not delete the backup.", async (actor) => {
    await deleteBackup(actor, (await params).id);
    return NextResponse.json({ ok: true });
  });
}
