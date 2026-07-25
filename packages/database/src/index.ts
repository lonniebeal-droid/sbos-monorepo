import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

/**
 * Singleton PrismaClient. In development the instance is cached on globalThis to
 * survive hot-reloads and avoid exhausting the database connection pool.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
