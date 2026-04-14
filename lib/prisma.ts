import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Enforce connection_limit=1 for serverless environments.
// Each Vercel function invocation is isolated, so a pool bigger than 1 just
// wastes connections that never get reused within the same invocation.
function buildDatabaseUrl() {
    const url = process.env.DATABASE_URL || "";
    if (!url || url.includes("connection_limit")) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}connection_limit=1&pool_timeout=10`;
}

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ["error"],
        datasources: { db: { url: buildDatabaseUrl() } },
    });

// Always cache the singleton on globalThis so warm lambda re-evaluations
// reuse the existing client instead of opening a new connection pool.
globalForPrisma.prisma = prisma;
