"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { createExpenseCategorySchema } from "@/lib/supplier-invoice-validators";

export async function listExpenseCategoriesAction() {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_READ");
  return prisma.expenseCategory.findMany({
    where: { organizationId: user.organizationId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createExpenseCategoryAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIER_INVOICES_CREATE");

  const parsed = createExpenseCategorySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const category = await prisma.expenseCategory.create({
    data: {
      organizationId: user.organizationId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      color: parsed.data.color ?? "#64748b",
      defaultVatRate: parsed.data.defaultVatRate,
      accountingAccountPlaceholder: parsed.data.accountingAccountPlaceholder || null,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "EXPENSE_CATEGORY_CREATED",
    entityType: "ExpenseCategory",
    entityId: category.id,
    entityLabel: category.name,
  });

  revalidatePath("/supplier-invoices");
  revalidatePath("/supplier-invoices/new");
  return { success: true, categoryId: category.id };
}
