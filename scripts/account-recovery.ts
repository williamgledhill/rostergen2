/**
 * Break-glass account recovery, for when no administrator can sign in.
 * Run it from your own machine with the production settings loaded:
 *
 *   npx vercel env pull .env.prod --environment=production
 *   npx dotenv-cli -e .env.prod -- npx tsx scripts/account-recovery.ts list
 *   npx dotenv-cli -e .env.prod -- npx tsx scripts/account-recovery.ts reset-link <email> [--reset-2fa]
 *   rm .env.prod
 *
 * reset-link prints a single-use link (valid 24 hours) for the account and
 * reactivates it if needed. --reset-2fa also turns off two-factor, for a lost
 * phone. Nothing here shows or sets a password, and every change is written to
 * the audit log.
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { createOpaqueAuthToken, hashAuthToken } from "../lib/sessionToken";

const RESET_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ACTOR = "account-recovery script";

const prisma = new PrismaClient();

function appOrigin() {
  const configured = process.env.APP_ORIGIN?.split(",")[0]?.trim();
  return configured ? new URL(configured).origin : "https://rostergentest.vercel.app";
}

async function list() {
  const users = await prisma.appUser.findMany({ orderBy: [{ role: "asc" }, { email: "asc" }] });
  if (users.length === 0) {
    console.log("No accounts yet. The first administrator is created from APP_BOOTSTRAP_ADMIN_* on first sign-in.");
    return;
  }
  for (const user of users) {
    const status = user.pendingApproval ? "awaiting approval" : user.isActive ? "active" : "deactivated";
    const lastLogin = user.lastLoginAt ? user.lastLoginAt.toISOString().slice(0, 10) : "never";
    console.log(
      `${user.role.padEnd(6)}  ${user.email.padEnd(36)}  ${user.name}  (${status}, 2FA ${user.totpEnabled ? "on" : "off"}, last sign-in ${lastLogin})`
    );
  }
}

async function resetLink(email: string, resetTwoFactor: boolean) {
  const user = await prisma.appUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw new Error(`No account with the email ${email}. Run "list" to see them.`);

  const rawToken = createOpaqueAuthToken();
  await prisma.$transaction(async (tx) => {
    await tx.appUser.update({
      where: { id: user.id },
      data: {
        isActive: true,
        pendingApproval: false,
        ...(resetTwoFactor
          ? { totpEnabled: false, totpSecretCiphertext: null, totpSecretNonce: null, totpRecoveryCodes: Prisma.JsonNull }
          : {}),
      },
    });
    if (resetTwoFactor) await tx.appMfaSetup.deleteMany({ where: { userId: user.id } });
    await tx.appPasswordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.appPasswordReset.create({
      data: { userId: user.id, tokenHash: hashAuthToken(rawToken), expiresAt: new Date(Date.now() + RESET_MAX_AGE_MS) },
    });
    await tx.appAuditLog.create({
      data: {
        actorEmail: ACTOR,
        action: "user.password_reset_issued",
        targetUserId: user.id,
        targetEmail: user.email,
        details: { viaScript: true, reactivated: !user.isActive, twoFactorReset: resetTwoFactor && user.totpEnabled },
      },
    });
  });

  const url = new URL("/signup/reset", appOrigin());
  url.searchParams.set("token", rawToken);
  console.log(`Account: ${user.name} <${user.email}> (${user.role})`);
  if (!user.isActive) console.log("The account was deactivated and has been reactivated.");
  if (resetTwoFactor && user.totpEnabled) console.log("Two-factor authentication has been turned off.");
  console.log("\nOpen this link within 24 hours to choose a new password (it works once):\n");
  console.log(url.toString());
}

async function main() {
  const [command, email, ...flags] = process.argv.slice(2);
  // Prisma reads .env on its own, so check the production settings were loaded
  // on purpose: a link signed with a different SESSION_SECRET would not work.
  if (command === "reset-link" && process.env.VERCEL_ENV !== "production") {
    throw new Error(
      "Load the production settings first: npx dotenv-cli -e .env.prod -- npx tsx scripts/account-recovery.ts …"
    );
  }
  if (command === "list") return list();
  if (command === "reset-link" && email) return resetLink(email, flags.includes("--reset-2fa"));
  console.log("Usage:\n  account-recovery.ts list\n  account-recovery.ts reset-link <email> [--reset-2fa]");
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
