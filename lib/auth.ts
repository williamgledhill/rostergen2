import { Prisma, type AppUser, type AppUserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/password";
import {
  buildOtpAuthUri,
  createTotpSecret,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  matchesRecoveryCode,
  verifyTotpCode,
} from "@/lib/totp";
import {
  createOpaqueAuthToken,
  hashAuthToken,
  LOGIN_CHALLENGE_MAX_AGE_SECONDS,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/sessionToken";

export type AuthRequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: AppUserRole;
  totpEnabled: boolean;
  mustChangePassword: boolean;
};

type SessionStore = Prisma.TransactionClient | typeof prisma;

type MfaCheckResult =
  | { ok: false }
  | { ok: true; nextRecoveryCodes?: string[] };

let bootstrapPromise: Promise<void> | null = null;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function mapUser(user: Pick<AppUser, "id" | "email" | "name" | "role" | "totpEnabled" | "mustChangePassword">): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    totpEnabled: user.totpEnabled,
    mustChangePassword: user.mustChangePassword,
  };
}

function coerceRecoveryCodes(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

async function createSessionRecord(db: SessionStore, userId: string, meta: AuthRequestMeta) {
  const rawToken = createOpaqueAuthToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.appSession.create({
    data: {
      userId,
      tokenHash: hashAuthToken(rawToken),
      expiresAt,
      mfaSatisfiedAt: new Date(),
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
    },
  });
  await db.appUser.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  return { rawToken, expiresAt };
}

function verifyTotpOrRecoveryCode(user: Pick<AppUser, "totpEnabled" | "totpSecretCiphertext" | "totpSecretNonce" | "totpRecoveryCodes">, code: string): MfaCheckResult {
  if (!user.totpEnabled || !user.totpSecretCiphertext || !user.totpSecretNonce) {
    return { ok: false };
  }

  const totpSecret = decryptSecret(user.totpSecretCiphertext, user.totpSecretNonce);
  if (verifyTotpCode(totpSecret, code)) {
    return { ok: true };
  }

  const recoveryCodes = coerceRecoveryCodes(user.totpRecoveryCodes);
  const recoveryMatch = matchesRecoveryCode(code, recoveryCodes);
  if (!recoveryMatch.matched) return { ok: false };

  return { ok: true, nextRecoveryCodes: recoveryMatch.nextHashedCodes };
}

export async function ensureBootstrapUser() {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const existingUserCount = await prisma.appUser.count();
    if (existingUserCount > 0) return;

    const email = process.env.APP_BOOTSTRAP_ADMIN_EMAIL?.trim();
    const password = process.env.APP_BOOTSTRAP_ADMIN_PASSWORD?.trim();
    const name = process.env.APP_BOOTSTRAP_ADMIN_NAME?.trim() || "Administrator";
    if (!email || !password) return;
    if (!validatePasswordStrength(password)) {
      throw new Error("APP_BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.");
    }

    await prisma.appUser.create({
      data: {
        email: normalizeEmail(email),
        name,
        role: "ADMIN",
        passwordHash: await hashPassword(password),
        mustChangePassword: process.env.NODE_ENV === "production",
      },
    });
  })().catch((error) => {
    bootstrapPromise = null;
    throw error;
  });

  return bootstrapPromise;
}

/**
 * A request for access is stored as an inactive editor marked pendingApproval.
 * An administrator approves it (activates the account) or rejects it (deletes it).
 */
export type AccountRequest = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

/**
 * Records a request for access. Says nothing about whether the email is already
 * registered, so the form can't be used to discover who has an account.
 */
export async function requestAccount(input: { name: string; email: string; password: string }) {
  // Make sure the first administrator exists before anyone else is added.
  await ensureBootstrapUser();

  const email = normalizeEmail(input.email);
  const existing = await prisma.appUser.findUnique({ where: { email }, select: { id: true } });
  if (existing) return;

  try {
    await prisma.appUser.create({
      data: {
        email,
        name: input.name.trim(),
        role: "EDITOR",
        passwordHash: await hashPassword(input.password),
        isActive: false,
        pendingApproval: true,
      },
    });
  } catch (error) {
    // Two requests for the same email at once: the first one wins.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
}

export async function listAccountRequests(): Promise<AccountRequest[]> {
  const users = await prisma.appUser.findMany({
    where: { pendingApproval: true },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }));
}

export async function approveAccountRequest(id: string) {
  const user = await prisma.appUser.findFirst({ where: { id, pendingApproval: true }, select: { email: true } });
  if (!user) return null;
  const result = await prisma.appUser.updateMany({
    where: { id, pendingApproval: true },
    data: { isActive: true, pendingApproval: false },
  });
  return result.count > 0 ? user : null;
}

export async function rejectAccountRequest(id: string) {
  const user = await prisma.appUser.findFirst({ where: { id, pendingApproval: true }, select: { email: true } });
  if (!user) return null;
  const result = await prisma.appUser.deleteMany({ where: { id, pendingApproval: true } });
  return result.count > 0 ? user : null;
}

export async function authenticateUser(email: string, password: string, meta: AuthRequestMeta) {
  await ensureBootstrapUser();

  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.appUser.findUnique({ where: { email: normalizedEmail } });
  if (!user) return null;

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) return null;

  // Only someone who knows the password learns the account is waiting.
  if (user.pendingApproval) return { pendingApproval: true as const };
  if (!user.isActive) return null;

  if (user.totpEnabled) {
    const challengeToken = createOpaqueAuthToken();
    await prisma.appLoginChallenge.create({
      data: {
        userId: user.id,
        tokenHash: hashAuthToken(challengeToken),
        expiresAt: new Date(Date.now() + LOGIN_CHALLENGE_MAX_AGE_SECONDS * 1000),
        ipAddress: meta.ipAddress || null,
        userAgent: meta.userAgent || null,
      },
    });

    return {
      requiresTwoFactor: true as const,
      challengeToken,
      user: mapUser(user),
    };
  }

  const { rawToken } = await createSessionRecord(prisma, user.id, meta);
  return {
    requiresTwoFactor: false as const,
    sessionToken: rawToken,
    user: mapUser(user),
  };
}

export async function completeTwoFactorLogin(challengeToken: string, code: string, meta: AuthRequestMeta) {
  const tokenHash = hashAuthToken(challengeToken);

  const result = await prisma.$transaction(async (tx) => {
    const challenge = await tx.appLoginChallenge.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || !challenge.user.isActive) {
      return null;
    }

    const mfaCheck = verifyTotpOrRecoveryCode(challenge.user, code);
    if (!mfaCheck.ok) return null;

    if (mfaCheck.nextRecoveryCodes) {
      await tx.appUser.update({
        where: { id: challenge.user.id },
        data: { totpRecoveryCodes: mfaCheck.nextRecoveryCodes },
      });
    }

    await tx.appLoginChallenge.update({
      where: { id: challenge.id },
      data: { usedAt: new Date() },
    });

    const session = await createSessionRecord(tx, challenge.user.id, meta);
    return {
      sessionToken: session.rawToken,
      user: mapUser(challenge.user),
    };
  });

  return result;
}

type SessionContextResult = {
  sessionId: string;
  user: AuthUser;
  expiresAt: Date;
  mfaSatisfiedAt: Date | null;
} | null;

/**
 * Every page and API request checks the session. The database is far away, so a
 * confirmed session is remembered briefly, and simultaneous requests share one
 * lookup. Signing out clears it straight away.
 */
const SESSION_CACHE_MS = 60_000;
const sessionCache = new Map<string, { value: Promise<SessionContextResult>; cachedAt: number }>();

async function lookupSession(tokenHash: string): Promise<SessionContextResult> {
  const session = await prisma.appSession.findUnique({
    where: { tokenHash },
    include: { user: true },
    relationLoadStrategy: "join",
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
    return null;
  }

  return {
    sessionId: session.id,
    user: mapUser(session.user),
    expiresAt: session.expiresAt,
    mfaSatisfiedAt: session.mfaSatisfiedAt,
  };
}

export async function getSessionContextFromToken(rawToken?: string | null) {
  if (!rawToken) return null;
  const tokenHash = hashAuthToken(rawToken);
  const now = Date.now();
  const cached = sessionCache.get(tokenHash);
  if (cached && now - cached.cachedAt < SESSION_CACHE_MS) {
    const context = await cached.value;
    if (!context || context.expiresAt > new Date()) return context;
  }

  const value = lookupSession(tokenHash);
  sessionCache.set(tokenHash, { value, cachedAt: now });
  value.catch(() => sessionCache.delete(tokenHash));
  // Keep the cache small: drop entries that are past their time.
  if (sessionCache.size > 500) {
    for (const [key, entry] of sessionCache) if (now - entry.cachedAt >= SESSION_CACHE_MS) sessionCache.delete(key);
  }
  return value;
}

/**
 * Forgets every remembered session on this server, so a revoked or deactivated
 * account stops working at once here (other servers catch up within a minute).
 */
export function forgetCachedSessions() {
  sessionCache.clear();
}

export async function revokeSession(rawToken?: string | null) {
  if (!rawToken) return;
  sessionCache.delete(hashAuthToken(rawToken));
  await prisma.appSession.updateMany({
    where: {
      tokenHash: hashAuthToken(rawToken),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
}

export async function getMfaStatus(userId: string) {
  const [user, setup] = await Promise.all([
    prisma.appUser.findUnique({
      where: { id: userId },
      select: { totpEnabled: true },
    }),
    prisma.appMfaSetup.findUnique({
      where: { userId },
      select: { expiresAt: true },
    }),
  ]);

  return {
    enabled: Boolean(user?.totpEnabled),
    setupPending: Boolean(setup && setup.expiresAt > new Date()),
    setupExpiresAt: setup?.expiresAt ?? null,
  };
}

export async function beginTotpSetup(userId: string, email: string) {
  const { secret } = createTotpSecret();
  const encrypted = encryptSecret(secret);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.appMfaSetup.upsert({
    where: { userId },
    update: {
      secretCiphertext: encrypted.ciphertext,
      secretNonce: encrypted.nonce,
      expiresAt,
    },
    create: {
      userId,
      secretCiphertext: encrypted.ciphertext,
      secretNonce: encrypted.nonce,
      expiresAt,
    },
  });

  return {
    secret,
    otpauthUri: buildOtpAuthUri(email, secret),
    expiresAt,
  };
}

export async function confirmTotpSetup(userId: string, code: string) {
  const result = await prisma.$transaction(async (tx) => {
    const setup = await tx.appMfaSetup.findUnique({ where: { userId } });
    if (!setup || setup.expiresAt <= new Date()) return null;

    const secret = decryptSecret(setup.secretCiphertext, setup.secretNonce);
    if (!verifyTotpCode(secret, code)) return null;

    const recoveryCodes = generateRecoveryCodes();
    await tx.appUser.update({
      where: { id: userId },
      data: {
        totpEnabled: true,
        totpSecretCiphertext: setup.secretCiphertext,
        totpSecretNonce: setup.secretNonce,
        totpRecoveryCodes: recoveryCodes.map(hashRecoveryCode),
      },
    });
    await tx.appMfaSetup.delete({ where: { userId } });

    return recoveryCodes;
  });

  return result;
}

export async function disableTotp(userId: string, password: string, code: string) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.appUser.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || !user.totpEnabled) return false;

    const passwordMatches = await verifyPassword(password, user.passwordHash);
    if (!passwordMatches) return false;

    const mfaCheck = verifyTotpOrRecoveryCode(user, code);
    if (!mfaCheck.ok) return false;

    await tx.appUser.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecretCiphertext: null,
        totpSecretNonce: null,
        totpRecoveryCodes: Prisma.JsonNull,
      },
    });
    await tx.appMfaSetup.deleteMany({ where: { userId } });
    return true;
  });

  return result;
}
