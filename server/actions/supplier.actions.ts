"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import { generateSuppliersCsv } from "@/lib/csv";
import {
  createSupplierSchema,
  supplierFilterSchema,
  updateSupplierSchema,
} from "@/lib/supplier-validators";
import { parseTagIds } from "@/lib/supplier-utils";
import {
  getAllSupplierTagsQuery,
  getSupplierByIdQuery,
  getSupplierCategoriesQuery,
  getSupplierStatsQuery,
  listSuppliersForExportQuery,
  listSuppliersQuery,
} from "@/lib/suppliers";

function emptyToNull(value?: string | number | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function boolFromForm(value?: string | boolean): boolean {
  return value === true || value === "true" || value === "on";
}

export async function listSuppliersAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_READ");

  const parsed = supplierFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 20 };

  return listSuppliersQuery(user.organizationId, filters);
}

export async function getSupplierStatsAction() {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_READ");

  const { suppliers, topCategories } = await getSupplierStatsQuery(user.organizationId);
  const { computeSupplierStats } = await import("@/lib/supplier-utils");
  return computeSupplierStats(suppliers, topCategories);
}

export async function getSupplierByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_READ");
  return getSupplierByIdQuery(user.organizationId, id);
}

export async function getSupplierTagsAction() {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_READ");
  return getAllSupplierTagsQuery(user.organizationId);
}

export async function getSupplierCategoriesAction() {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_READ");
  return getSupplierCategoriesQuery(user.organizationId);
}

export async function createSupplierAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_CREATE");

  const raw = Object.fromEntries(formData.entries());
  const parsed = createSupplierSchema.safeParse({
    ...raw,
    isPreferred: boolFromForm(raw.isPreferred as string),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const supplierNumber = await generateNextNumber(user.organizationId, "SUPPLIER", user.id);
  const tagIds = parseTagIds(data.tagIds);

  const supplier = await prisma.$transaction(async (tx) => {
    const created = await tx.supplier.create({
      data: {
        organizationId: user.organizationId,
        supplierNumber,
        type: data.type,
        status: data.status,
        name: data.name,
        legalName: emptyToNull(data.legalName),
        displayName: emptyToNull(data.displayName),
        email: emptyToNull(data.email),
        phone: emptyToNull(data.phone),
        website: emptyToNull(data.website),
        siret: emptyToNull(data.siret),
        vatNumber: emptyToNull(data.vatNumber),
        legalForm: emptyToNull(data.legalForm),
        industry: emptyToNull(data.industry),
        categoryId: emptyToNull(data.categoryId),
        defaultPaymentTermsDays: data.defaultPaymentTermsDays,
        defaultVatRate: data.defaultVatRate,
        currency: data.currency,
        outstandingAmount: data.outstandingAmount,
        totalPurchasesAmount: data.totalPurchasesAmount,
        riskLevel: data.riskLevel,
        isPreferred: data.isPreferred ?? false,
        notes: emptyToNull(data.notes),
      },
    });

    if (data.addressLine1 && data.postalCode && data.city) {
      await tx.supplierAddress.create({
        data: {
          organizationId: user.organizationId,
          supplierId: created.id,
          type: data.addressType ?? "HEADQUARTERS",
          label: emptyToNull(data.addressLabel),
          addressLine1: data.addressLine1,
          addressLine2: emptyToNull(data.addressLine2),
          postalCode: data.postalCode,
          city: data.city,
          region: emptyToNull(data.region),
          country: data.country ?? "FR",
          isDefault: true,
        },
      });
    }

    if (data.contactFirstName && data.contactLastName) {
      await tx.supplierContact.create({
        data: {
          organizationId: user.organizationId,
          supplierId: created.id,
          firstName: data.contactFirstName,
          lastName: data.contactLastName,
          jobTitle: emptyToNull(data.contactJobTitle),
          email: emptyToNull(data.contactEmail),
          phone: emptyToNull(data.contactPhone),
          mobile: emptyToNull(data.contactMobile),
          isPrimary: true,
        },
      });
    }

    if (data.bankIban && data.bankLabel) {
      await tx.supplierBankAccount.create({
        data: {
          organizationId: user.organizationId,
          supplierId: created.id,
          label: data.bankLabel,
          iban: data.bankIban,
          bic: emptyToNull(data.bankBic),
          bankName: emptyToNull(data.bankName),
          accountHolder: emptyToNull(data.bankAccountHolder),
          isDefault: true,
          isActive: true,
        },
      });
    }

    if (data.noteContent) {
      await tx.supplierNote.create({
        data: {
          organizationId: user.organizationId,
          supplierId: created.id,
          userId: user.id,
          content: data.noteContent,
        },
      });
    }

    for (const tagId of tagIds) {
      await tx.supplierTagAssignment.create({
        data: { organizationId: user.organizationId, supplierId: created.id, tagId },
      });
    }

    await tx.supplierActivity.create({
      data: {
        organizationId: user.organizationId,
        supplierId: created.id,
        type: "SUPPLIER_CREATED",
        title: "Fournisseur créé",
        description: `${supplierNumber} — ${data.name}`,
      },
    });

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_CREATED",
    entityType: "Supplier",
    entityId: supplier.id,
    entityLabel: `${supplier.supplierNumber} — ${supplier.name}`,
    newValues: { supplierNumber, name: supplier.name, status: supplier.status },
  });

  revalidatePath("/suppliers");
  return { success: true, supplierId: supplier.id };
}

export async function updateSupplierAction(supplierId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_UPDATE");

  const existing = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Fournisseur introuvable" };
  if (existing.isArchived) return { success: false, error: "Réactivez le fournisseur avant modification" };

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateSupplierSchema.safeParse({
    ...raw,
    isPreferred: boolFromForm(raw.isPreferred as string),
  });
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const tagIds = parseTagIds(data.tagIds);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.supplier.update({
      where: { id: supplierId },
      data: {
        type: data.type,
        status: data.status,
        name: data.name,
        legalName: emptyToNull(data.legalName),
        displayName: emptyToNull(data.displayName),
        email: emptyToNull(data.email),
        phone: emptyToNull(data.phone),
        website: emptyToNull(data.website),
        siret: emptyToNull(data.siret),
        vatNumber: emptyToNull(data.vatNumber),
        legalForm: emptyToNull(data.legalForm),
        industry: emptyToNull(data.industry),
        categoryId: emptyToNull(data.categoryId),
        defaultPaymentTermsDays: data.defaultPaymentTermsDays,
        defaultVatRate: data.defaultVatRate,
        currency: data.currency,
        outstandingAmount: data.outstandingAmount,
        totalPurchasesAmount: data.totalPurchasesAmount,
        riskLevel: data.riskLevel,
        isPreferred: data.isPreferred ?? false,
        notes: emptyToNull(data.notes),
      },
    });

    await tx.supplierTagAssignment.deleteMany({ where: { supplierId } });
    for (const tagId of tagIds) {
      await tx.supplierTagAssignment.create({
        data: { organizationId: user.organizationId, supplierId, tagId },
      });
    }

    await tx.supplierActivity.create({
      data: {
        organizationId: user.organizationId,
        supplierId,
        type: "SUPPLIER_UPDATED",
        title: "Fournisseur modifié",
      },
    });

    return result;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_UPDATED",
    entityType: "Supplier",
    entityId: updated.id,
    entityLabel: `${updated.supplierNumber} — ${updated.name}`,
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath(`/suppliers/${supplierId}/edit`);
  return { success: true };
}

export async function archiveSupplierAction(supplierId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_DELETE");

  const existing = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Fournisseur introuvable" };
  if (existing.isArchived) return { success: false, error: "Fournisseur déjà archivé" };

  const updated = await prisma.supplier.update({
    where: { id: supplierId },
    data: { status: "ARCHIVED", isArchived: true, archivedAt: new Date() },
  });

  await prisma.supplierActivity.create({
    data: {
      organizationId: user.organizationId,
      supplierId,
      type: "NOTE",
      title: "Fournisseur archivé",
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_ARCHIVED",
    entityType: "Supplier",
    entityId: updated.id,
    entityLabel: `${updated.supplierNumber} — ${updated.name}`,
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  return { success: true };
}

export async function reactivateSupplierAction(supplierId: string) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_DELETE");

  const existing = await prisma.supplier.findFirst({
    where: { id: supplierId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Fournisseur introuvable" };
  if (!existing.isArchived) return { success: false, error: "Fournisseur non archivé" };

  const updated = await prisma.supplier.update({
    where: { id: supplierId },
    data: { status: "ACTIVE", isArchived: false, archivedAt: null },
  });

  await prisma.supplierActivity.create({
    data: {
      organizationId: user.organizationId,
      supplierId,
      type: "SUPPLIER_UPDATED",
      title: "Fournisseur réactivé",
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_REACTIVATED",
    entityType: "Supplier",
    entityId: updated.id,
    entityLabel: `${updated.supplierNumber} — ${updated.name}`,
  });

  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${supplierId}`);
  return { success: true };
}

export async function exportSuppliersCsvAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "SUPPLIERS_EXPORT");

  const parsed = supplierFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : {};

  const suppliers = await listSuppliersForExportQuery(user.organizationId, filters);
  const csv = generateSuppliersCsv(suppliers);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SUPPLIER_EXPORTED",
    entityType: "Supplier",
    entityLabel: `${suppliers.length} fournisseurs`,
  });

  return { success: true, csv, filename: "fournisseurs.csv" };
}
