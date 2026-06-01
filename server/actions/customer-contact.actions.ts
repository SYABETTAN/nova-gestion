"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createCustomerContactSchema,
  updateCustomerContactSchema,
} from "@/lib/customer-validators";

async function getCustomerForOrg(customerId: string, organizationId: string) {
  return prisma.customer.findFirst({ where: { id: customerId, organizationId } });
}

function revalidateCustomer(customerId: string) {
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}

export async function createCustomerContactAction(customerId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const customer = await getCustomerForOrg(customerId, user.organizationId);
  if (!customer) return { success: false, error: "Client introuvable" };

  const parsed = createCustomerContactSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const existingCount = await prisma.customerContact.count({
    where: { customerId, organizationId: user.organizationId },
  });

  const isPrimary = data.isPrimary ?? existingCount === 0;

  if (isPrimary) {
    await prisma.customerContact.updateMany({
      where: { customerId, organizationId: user.organizationId },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.customerContact.create({
    data: {
      organizationId: user.organizationId,
      customerId,
      firstName: data.firstName,
      lastName: data.lastName,
      jobTitle: data.jobTitle || null,
      email: data.email || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      isPrimary,
      notes: data.notes || null,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_CONTACT_CREATED",
    entityType: "CustomerContact",
    entityId: contact.id,
    entityLabel: `${data.firstName} ${data.lastName}`,
  });

  revalidateCustomer(customerId);
  return { success: true };
}

export async function updateCustomerContactAction(contactId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const existing = await prisma.customerContact.findFirst({
    where: { id: contactId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Contact introuvable" };

  const parsed = updateCustomerContactSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;

  if (data.isPrimary) {
    await prisma.customerContact.updateMany({
      where: { customerId: existing.customerId, organizationId: user.organizationId },
      data: { isPrimary: false },
    });
  }

  const contact = await prisma.customerContact.update({
    where: { id: contactId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      jobTitle: data.jobTitle || null,
      email: data.email || null,
      phone: data.phone || null,
      mobile: data.mobile || null,
      isPrimary: data.isPrimary ?? existing.isPrimary,
      notes: data.notes || null,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_CONTACT_UPDATED",
    entityType: "CustomerContact",
    entityId: contact.id,
    entityLabel: `${contact.firstName} ${contact.lastName}`,
  });

  revalidateCustomer(existing.customerId);
  return { success: true };
}

export async function deleteCustomerContactAction(contactId: string) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const existing = await prisma.customerContact.findFirst({
    where: { id: contactId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Contact introuvable" };

  await prisma.customerContact.delete({ where: { id: contactId } });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_CONTACT_DELETED",
    entityType: "CustomerContact",
    entityId: contactId,
    entityLabel: `${existing.firstName} ${existing.lastName}`,
  });

  revalidateCustomer(existing.customerId);
  return { success: true };
}

export async function setPrimaryContactAction(contactId: string) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const existing = await prisma.customerContact.findFirst({
    where: { id: contactId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Contact introuvable" };

  await prisma.customerContact.updateMany({
    where: { customerId: existing.customerId, organizationId: user.organizationId },
    data: { isPrimary: false },
  });

  await prisma.customerContact.update({
    where: { id: contactId },
    data: { isPrimary: true },
  });

  revalidateCustomer(existing.customerId);
  return { success: true };
}
