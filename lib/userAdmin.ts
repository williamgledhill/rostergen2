import { Prisma, type AppUserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { forgetCachedSessions } from "@/lib/auth";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/password";
import { createOpaqueAuthToken, hashAuthToken } from "@/lib/sessionToken";

/**
 * Account administration. Administrators never see or choose another person's
 * password: they issue a single-use reset link instead. Every change is written
 * to the audit log.
 */

export const PASSWORD_RESET_MAX_AGE_SECONDS = 60 * 60 * 24;

export type Actor = { id: string; email: string; ipAddress?: string | null };

export type ManagedUser = {
  id: string;
  email: string;
  name: string;
  role: AppUserRole;
  isActive: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  actorEmail: string | null;
  action: string;
  targetEmail: string | null;
  details: unknown;
  createdAt: string;
};

export class UserAdminError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type Db = Prisma.TransactionClient | typeof prisma;

export async function recordAudit(
  db: Db,
  actor: Actor | null,
  action: string,
  target?: { id: string; email: string } | null,
  details?: Prisma.InputJsonValue
) {
  await db.appAuditLog.create({
    data: {
      actorId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      action,
      targetUserId: target?.id ?? null,
      targetEmail: target?.email ?? null,
      details: details ?? Prisma.JsonNull,
      ipAddress: actor?.ipAddress ?? null,
    },
  });
}

async function revokeAllSessions(db: Db, userId: string, exceptSessionId?: string) {
  await db.appSession.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
}

async function findManagedUser(db: Db, id: string) {
  const user = await db.appUser.findFirst({ where: { id, pendingApproval: false } });
  if (!user) throw new UserAdminError("User not found", 404);
  return user;
}

/** Stops a change that would leave nobody able to administer the app. */
async function assertAnotherActiveAdmin(db: Db, userId: string) {
  const others = await db.appUser.count({
    where: { role: "ADMIN", isActive: true, pendingApproval: false, id: { not: userId } },
  });
  if (others === 0) throw new UserAdminError("There must always be at least one active administrator.");
}

export async function listUsers(): Promise<ManagedUser[]> {
  const users = await prisma.appUser.findMany({
    where: { pendingApproval: false },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      totpEnabled: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return users.map((user) => ({
    ...user,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }));
}

export async function listAuditLog(limit = 50): Promise<AuditEntry[]> {
  const entries = await prisma.appAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, actorEmail: true, action: true, targetEmail: true, details: true, createdAt: true },
  });
  return entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() }));
}

export async function changeUserRole(actor: Actor, id: string, role: AppUserRole) {
  await prisma.$transaction(async (tx) => {
    const user = await findManagedUser(tx, id);
    if (user.role === role) return;
    if (user.id === actor.id) throw new UserAdminError("You can't change your own role.");
    if (user.role === "ADMIN") await assertAnotherActiveAdmin(tx, user.id);

    await tx.appUser.update({ where: { id }, data: { role } });
    await recordAudit(tx, actor, "user.role_changed", user, { from: user.role, to: role });
  });
  forgetCachedSessions();
}

export async function setUserActive(actor: Actor, id: string, isActive: boolean) {
  await prisma.$transaction(async (tx) => {
    const user = await findManagedUser(tx, id);
    if (user.isActive === isActive) return;
    if (!isActive) {
      if (user.id === actor.id) throw new UserAdminError("You can't deactivate your own account.");
      if (user.role === "ADMIN") await assertAnotherActiveAdmin(tx, user.id);
      await revokeAllSessions(tx, user.id);
    }

    await tx.appUser.update({ where: { id }, data: { isActive } });
    await recordAudit(tx, actor, isActive ? "user.reactivated" : "user.deactivated", user);
  });
  forgetCachedSessions();
}

export async function signOutUserEverywhere(actor: Actor, id: string) {
  await prisma.$transaction(async (tx) => {
    const user = await findManagedUser(tx, id);
    await revokeAllSessions(tx, user.id);
    await recordAudit(tx, actor, "user.sessions_revoked", user);
  });
  forgetCachedSessions();
}

export async function resetUserTwoFactor(actor: Actor, id: string) {
  await prisma.$transaction(async (tx) => {
    const user = await findManagedUser(tx, id);
    if (!user.totpEnabled) throw new UserAdminError("Two-factor authentication is already off for this user.");

    await tx.appUser.update({
      where: { id },
      data: {
        totpEnabled: false,
        totpSecretCiphertext: null,
        totpSecretNonce: null,
        totpRecoveryCodes: Prisma.JsonNull,
      },
    });
    await tx.appMfaSetup.deleteMany({ where: { userId: id } });
    await revokeAllSessions(tx, user.id);
    await recordAudit(tx, actor, "user.two_factor_reset", user);
  });
  forgetCachedSessions();
}

/**
 * Issues a single-use reset link. Any earlier unused link for the user stops
 * working. Only the token's hash is stored, so the link can't be shown again.
 */
export async function issuePasswordReset(actor: Actor, id: string) {
  const rawToken = createOpaqueAuthToken();
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_MAX_AGE_SECONDS * 1000);

  await prisma.$transaction(async (tx) => {
    const user = await findManagedUser(tx, id);
    if (!user.isActive) throw new UserAdminError("Reactivate this account before resetting its password.");

    await tx.appPasswordReset.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.appPasswordReset.create({
      data: { userId: id, tokenHash: hashAuthToken(rawToken), expiresAt, createdById: actor.id },
    });
    await recordAudit(tx, actor, "user.password_reset_issued", user);
  });

  return { token: rawToken, expiresAt };
}

async function findUsableReset(db: Db, rawToken: string) {
  const reset = await db.appPasswordReset.findUnique({
    where: { tokenHash: hashAuthToken(rawToken) },
    include: { user: true },
  });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date() || !reset.user.isActive) return null;
  return reset;
}

/** What the reset page shows before the new password is chosen. */
export async function describePasswordReset(rawToken: string) {
  const reset = await findUsableReset(prisma, rawToken);
  return reset ? { name: reset.user.name, email: reset.user.email } : null;
}

export async function completePasswordReset(rawToken: string, newPassword: string, ipAddress?: string | null) {
  if (!validatePasswordStrength(newPassword)) {
    throw new UserAdminError("Use a password of at least 12 characters.");
  }
  const passwordHash = await hashPassword(newPassword);

  const completed = await prisma.$transaction(async (tx) => {
    const reset = await findUsableReset(tx, rawToken);
    if (!reset) return false;

    await tx.appUser.update({
      where: { id: reset.userId },
      data: { passwordHash, mustChangePassword: false },
    });
    await tx.appPasswordReset.updateMany({
      where: { userId: reset.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await revokeAllSessions(tx, reset.userId);
    await recordAudit(
      tx,
      { id: reset.user.id, email: reset.user.email, ipAddress },
      "user.password_reset_completed",
      reset.user
    );
    return true;
  });

  if (!completed) throw new UserAdminError("This reset link is invalid or has expired. Ask an administrator for a new one.");
  forgetCachedSessions();
}

/** A signed-in user changing their own password. Other devices are signed out. */
export async function changeOwnPassword(
  actor: Actor,
  currentSessionId: string,
  currentPassword: string,
  newPassword: string
) {
  if (!validatePasswordStrength(newPassword)) {
    throw new UserAdminError("Use a new password of at least 12 characters.");
  }

  const user = await prisma.appUser.findUnique({ where: { id: actor.id } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new UserAdminError("Your current password is incorrect.");
  }
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.appUser.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    await revokeAllSessions(tx, user.id, currentSessionId);
    await recordAudit(tx, actor, "user.password_changed", user);
  });
  forgetCachedSessions();
}
