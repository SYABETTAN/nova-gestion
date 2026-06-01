"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";
import {
  createCustomerAddressSchema,
  updateCustomerAddressSchema,
} from "@/lib/customer-validators";

function revalidateCustomer(customerId: string) {
  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
}

export async function createCustomerAddressAction(customerId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, organizationId: user.organizationId },
  });
  if (!customer) return { success: false, error: "Client introuvable" };

  const parsed = createCustomerAddressSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;
  const existingCount = await prisma.customerAddress.count({
    where: { customerId, organizationId: user.organizationId },
  });

  const isDefault = data.isDefault ?? existingCount === 0;

  if (isDefault) {
    await prisma.customerAddress.updateMany({
      where: { customerId, organizationId: user.organizationId, type: data.type },
      data: { isDefault: false },
    });
  }

  const address = await prisma.customerAddress.create({
    data: {
      organizationId: user.organizationId,
      customerId,
      type: data.type,
      label: data.label || null,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || null,
      postalCode: data.postalCode,
      city: data.city,
      region: data.region || null,
      country: data.country,
      isDefault,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_ADDRESS_CREATED",
    entityType: "CustomerAddress",
    entityId: address.id,
    entityLabel: `${data.city} (${data.type})`,
  });

  revalidateCustomer(customerId);
  return { success: true };
}

export async function updateCustomerAddressAction(addressId: string, formData: FormData) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Adresse introuvable" };

  const parsed = updateCustomerAddressSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message ?? "Données invalides" };
  }

  const data = parsed.data;

  if (data.isDefault) {
    await prisma.customerAddress.updateMany({
      where: {
        customerId: existing.customerId,
        organizationId: user.organizationId,
        type: data.type,
      },
      data: { isDefault: false },
    });
  }

  const address = await prisma.customerAddress.update({
    where: { id: addressId },
    data: {
      type: data.type,
      label: data.label || null,
      addressLine1: data.addressLine1,
      addressLine2: data.addressLine2 || null,
      postalCode: data.postalCode,
      city: data.city,
      region: data.region || null,
      country: data.country,
      isDefault: data.isDefault ?? existing.isDefault,
    },
  });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_ADDRESS_UPDATED",
    entityType: "CustomerAddress",
    entityId: address.id,
    entityLabel: `${address.city} (${address.type})`,
  });

  revalidateCustomer(existing.customerId);
  return { success: true };
}

export async function deleteCustomerAddressAction(addressId: string) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Adresse introuvable" };

  await prisma.customerAddress.delete({ where: { id: addressId } });

  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CUSTOMER_ADDRESS_DELETED",
    entityType: "CustomerAddress",
    entityId: addressId,
    entityLabel: `${existing.city} (${existing.type})`,
  });

  revalidateCustomer(existing.customerId);
  return { success: true };
}

export async function setDefaultAddressAction(addressId: string) {
  const user = await requireAuth();
  requirePermission(user, "CUSTOMERS_UPDATE");

  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, organizationId: user.organizationId },
  });
  if (!existing) return { success: false, error: "Adresse introuvable" };

  await prisma.customerAddress.updateMany({
    where: {
      customerId: existing.customerId,
      organizationId: user.organizationId,
      type: existing.type,
    },
    data: { isDefault: false },
  });

  await prisma.customerAddress.update({
    where: { id: addressId },
    data: { isDefault: true },
  });

  revalidateCustomer(existing.customerId);
  return { success: true };
}
