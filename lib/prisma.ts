import { PrismaClient } from "@prisma/client";
import { serializeMoneyForClient } from "@/lib/money";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ query, args }) {
          const result = await query(args);
          return serializeMoneyForClient(result);
        },
      },
    },
  });
}

/** Client Prisma — les Decimal sont convertis en number à la lecture pour l'UI. */
export const prisma = (globalForPrisma.prisma ?? createClient()) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
