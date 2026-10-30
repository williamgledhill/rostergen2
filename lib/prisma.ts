import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * On Vercel each function instance gets one connection. Running locally the app
 * is one long-lived process, so a single connection makes requests queue up
 * behind each other (and saves time out waiting for it).
 */
function withServerlessConnectionLimit(url?: string) {
  if (!url || process.env.NODE_ENV !== "production") return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "1");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "20");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const prismaClientSingleton =
  global.prisma ??
  new PrismaClient({
    datasourceUrl: withServerlessConnectionLimit(process.env.DATABASE_URL),
    // The database is remote, so allow more than the 2s default to get a connection.
    transactionOptions: { maxWait: 10_000, timeout: 20_000 },
  });

global.prisma = prismaClientSingleton;

export const prisma = prismaClientSingleton;
