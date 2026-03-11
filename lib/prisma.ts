import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// In serverless environments like Vercel, it is highly recommended to append 
// ?connection_limit=5&pool_timeout=10 to your DATABASE_URL to avoid connection exhaustion.
export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        log: ["error", "warn"], // Reduced logging in production to save memory/I/O
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
