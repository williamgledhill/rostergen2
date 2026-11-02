import { NextResponse, after } from "next/server";
import { requireSession } from "@/lib/apiAuth";
import { serverError } from "@/lib/apiHelpers";
import { createBackup, ensureRecentAutomaticBackup, listBackups } from "@/lib/backups";
import { recordAudit } from "@/lib/userAdmin";
import { prisma } from "@/lib/prisma";
import { runAdminAction } from "@/lib/userAdminRoute";

export async function GET() {
  const auth = await requireSession({ adminOnly: true });
  if (!auth.ok) return auth.response;

  try {
    // Opening the list is a good moment to catch up if no roster has been saved for a while.
    after(() => ensureRecentAutomaticBackup().catch((err) => console.error("Automatic backup failed", err)));
    return NextResponse.json({ backups: await listBackups() });
  } catch (err) {
    return serverError(err);
  }
}

/** Takes a backup now. */
export async function POST(request: Request) {
  return runAdminAction(request, "Could not take a backup.", async (actor) => {
    const backup = await createBackup("manual", actor);
    await recordAudit(prisma, actor, "backup.created", null, { backupId: backup.id });
    return NextResponse.json({ backup }, { status: 201 });
  });
}
