import { prisma } from "@/lib/prisma";

export async function listExpenseCategoriesQuery(organizationId: string) {
  return prisma.expenseCategory.findMany({
    where: { organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getExpenseCategoryByIdQuery(organizationId: string, id: string) {
  return prisma.expenseCategory.findFirst({
    where: { id, organizationId },
  });
}
