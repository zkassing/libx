import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 单例。
 * Next dev 的 HMR 会反复加载模块，不缓存会不断新建连接把 SQLite 句柄耗尽。
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
