import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Force connection_limit=1 for serverless environments.
function buildDatabaseUrl() {
    let url = process.env.DATABASE_URL || "";
    if (!url) return url;
    url = url.replace(/[&?]connection_limit=\d+/g, "").replace(/[&?]pool_timeout=\d+/g, "");
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}connection_limit=1&pool_timeout=10`;
}

function createClient() {
    return new PrismaClient({
        log: ["error"],
        datasources: { db: { url: buildDatabaseUrl() } },
    });
}

export const prisma = globalForPrisma.prisma || createClient();
globalForPrisma.prisma = prisma;

/**
 * Wraps a serverless route handler, ensuring the Prisma connection is
 * released after every request — prevents warm lambdas from holding
 * idle connections against the MySQL max_user_connections limit.
 */
export async function withDB<T>(fn: () => Promise<T>): Promise<T> {
    try {
        return await fn();
    } finally {
        await prisma.$disconnect();
    }
}
