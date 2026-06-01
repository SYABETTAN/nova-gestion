"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import { generateNextNumber } from "@/lib/numbering";
import { moneyToNumber } from "@/lib/money";
import { generateCustomersCsv } from "@/lib/csv";
import {
  createCustomerSchema,
  customerFilterSchema,
  updateCustomerSchema,
} from "@/lib/customer-validators";
import { parseTagIds } from "@/lib/customer-utils";
import {
  getAllTagsQuery,
  getCustomerByIdQuery,
  getCustomerStatsQuery,
  listCustomersQuery,
} from "@/lib/customers";

function emptyToNull(value?: string | number | null): string | null {
  if (value === undefined || value === null || value === "") return null;
  return String(value);
}

function numOrNull(value?: string | number | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  return Number(value);
}

export async function listCustomersAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_READ");

  const parsed = customerFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : { page: 1, pageSize: 20 };

  return listCustomersQuery(user.organizationId, filters);
}

export async function getCustomerStatsAction() {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_READ");

  const stats = await getCustomerStatsQuery(user.organizationId);
  return {
    total: stats.total,
    prospects: stats.prospects,
    active: stats.active,
    totalOutstanding: moneyToNumber(stats.totalOutstanding),
  };
}

export async function getCustomerByIdAction(id: string) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_READ");

  const customer = await getCustomerByIdQuery(user.organizationId, id);
  if (!customer) return null;
  return customer;
}

export async function getCustomerTagsAction() {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_READ");
  return getAllTagsQuery(user.organizationId);
}

export async function createCustomerAction(formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_CREATE");

  const raw = Object.fromEntries(formData.entries());
  const parsed = createCustomerSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const customerNumber = await generateNextNumber(user.organizationId, "CUSTOMER", user.id);
  const tagIds = parseTagIds(data.tagIds);

  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        organizationId: user.organizationId,
        customerNumber,
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
        employeeCount: numOrNull(data.employeeCount),
        annualRevenue: numOrNull(data.annualRevenue),
        defaultPaymentTermsDays: data.defaultPaymentTermsDays,
        defaultVatRate: data.defaultVatRate,
        currency: data.currency,
        creditLimit: data.creditLimit,
        outstandingAmount: data.outstandingAmount,
        notes: emptyToNull(data.notes),
      },
    });

    if (data.addressLine1 && data.postalCode && data.city) {
      await tx.customerAddress.create({
        data: {
          organizationId: user.organizationId,
          customerId: created.id,
          type: data.addressType ?? "BILLING",
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
      await tx.customerContact.create({
        data: {
          organizationId: user.organizationId,
          customerId: created.id,
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

    if (data.noteContent) {
      await tx.customerNote.create({
        data: {
          organizationId: user.organizationId,
          customerId: created.id,
          userId: user.id,
          content: data.noteContent,
        },
      });
    }

    for (const tagId of tagIds) {
      await tx.customerTagAssignment.create({
        data: {
          organizationId: user.organizationId,
          customerId: created.id,
          tagId,
        },
      });
    }

    return created;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_CREATED",
    entityType: "Customer",
    entityId: customer.id,
    entityLabel: `${customer.customerNumber} — ${customer.name}`,
    newValues: { customerNumber, name: customer.name, status: customer.status },
  });

  revalidatePath("/customers");
  return { success: true, customerId: customer.id };
}

export async function updateCustomerAction(customerId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: user.organizationId },
  });

  if (!existing) {
    return { success: false, error: "Client introuvable" };
  }

  if (existing.isArchived) {
    return { success: false, error: "Réactivez le client avant modification" };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = updateCustomerSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const tagIds = parseTagIds(data.tagIds);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.customer.update({
      where: { id: customerId },
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
        employeeCount: numOrNull(data.employeeCount),
        annualRevenue: numOrNull(data.annualRevenue),
        defaultPaymentTermsDays: data.defaultPaymentTermsDays,
        defaultVatRate: data.defaultVatRate,
        currency: data.currency,
        creditLimit: data.creditLimit,
        outstandingAmount: data.outstandingAmount,
        notes: emptyToNull(data.notes),
      },
    });

    await tx.customerTagAssignment.deleteMany({ where: { customerId } });
    for (const tagId of tagIds) {
      await tx.customerTagAssignment.create({
        data: {
          organizationId: user.organizationId,
          customerId,
          tagId,
        },
      });
    }

    return result;
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_UPDATED",
    entityType: "Customer",
    entityId: updated.id,
    entityLabel: `${updated.customerNumber} — ${updated.name}`,
    oldValues: { name: existing.name, status: existing.status },
    newValues: { name: updated.name, status: updated.status },
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/customers/${customerId}/edit`);
  return { success: true };
}

export async function archiveCustomerAction(customerId: string) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_DELETE");

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: user.organizationId },
  });

  if (!existing) {
    return { success: false, error: "Client introuvable" };
  }

  if (existing.isArchived) {
    return { success: false, error: "Client déjà archivé" };
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      status: "ARCHIVED",
      isArchived: true,
      archivedAt: new Date(),
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_ARCHIVED",
    entityType: "Customer",
    entityId: updated.id,
    entityLabel: `${updated.customerNumber} — ${updated.name}`,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { success: true };
}

export async function reactivateCustomerAction(customerId: string) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_DELETE");

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: user.organizationId },
  });

  if (!existing) {
    return { success: false, error: "Client introuvable" };
  }

  if (!existing.isArchived) {
    return { success: false, error: "Client non archivé" };
  }

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      status: "ACTIVE",
      isArchived: false,
      archivedAt: null,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_REACTIVATED",
    entityType: "Customer",
    entityId: updated.id,
    entityLabel: `${updated.customerNumber} — ${updated.name}`,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${customerId}`);
  return { success: true };
}

export async function exportCustomersCsvAction(searchParams: Record<string, string | undefined>) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_READ");

  const parsed = customerFilterSchema.safeParse(searchParams);
  const filters = parsed.success ? parsed.data : {};

  const { buildCustomerWhere } = await import("@/lib/customers");
  const where = buildCustomerWhere(user.organizationId, { ...filters, page: 1, pageSize: 10000 });

  const customers = await prisma.customer.findMany({
    where,
    include: { addresses: true },
    orderBy: { name: "asc" },
  });

  const csv = generateCustomersCsv(customers);

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_EXPORTED",
    entityType: "Customer",
    entityLabel: `${customers.length} clients exportés`,
    newValues: { count: customers.length },
  });

  return { success: true, csv, filename: "clients.csv" };
}
