import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function pooledDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value || process.env.NODE_ENV !== "production") return value;
  try {
    const url = new URL(value);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") return value;
    url.searchParams.set("pgbouncer", "true");
    url.searchParams.set("connection_limit", "1");
    return url.toString();
  } catch {
    return value;
  }
}

const databaseUrl = pooledDatabaseUrl();
export const prisma = globalForPrisma.prisma ?? new PrismaClient(
  databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined,
);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
