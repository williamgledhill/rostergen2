import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

function withServerlessConnectionLimit(url?: string) {
  if (!url) return undefined;
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
  });

global.prisma = prismaClientSingleton;

export const prisma = prismaClientSingleton;
