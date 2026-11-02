import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { jsonError, parseJsonBody } from "@/lib/apiHelpers";
import { parseBackupData, readBackup, restoreBackup } from "@/lib/backups";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { runAdminAction } from "@/lib/userAdminRoute";

const restoreSchema = z.union([
  z.object({ backupId: z.string().trim().min(1).max(120) }),
  z.object({ data: z.unknown(), fileName: z.string().max(255).optional() }),
]);

/** Replaces the current data with a saved backup, or with a backup file that was uploaded. */
export async function POST(request: Request) {
  return runAdminAction(request, "Could not restore the backup.", async (actor) => {
    const body = await parseJsonBody(request, restoreSchema);
    if (!body.ok) return body.response;

    let result;
    if ("backupId" in body.data) {
      const backup = await readBackup(body.data.backupId);
      if (!backup) return jsonError("Backup not found", 404);
      result = await restoreBackup(actor, backup.data, { backupId: body.data.backupId });
    } else {
      result = await restoreBackup(actor, parseBackupData(body.data.data), { fileName: body.data.fileName });
    }

    Object.values(CACHE_TAGS).forEach((tag) => revalidateTag(tag, "max"));
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, ...result });
  });
}
