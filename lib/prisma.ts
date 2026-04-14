import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Force connection_limit=1 for serverless environments.
// Each Vercel invocation is isolated — a larger pool only wastes connections.
// We override whatever value is in DATABASE_URL to ensure it's always 1.
function buildDatabaseUrl() {
    let url = process.env.DATABASE_URL || "";
    if (!url) return url;
    // Strip existing connection_limit and pool_timeout params, then re-add with safe values
    url = url.replace(/[&?]connection_limit=\d+/g, "").replace(/[&?]pool_timeout=\d+/g, "");
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
