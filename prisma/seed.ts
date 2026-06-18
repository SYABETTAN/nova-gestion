import {
  AuditAction,
  PermissionKey,
  PrismaClient,
  SystemRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  DEMO_NUMBERING_SEQUENCES,
  DEMO_ORGANIZATION,
  DEMO_PASSWORD,
  DEMO_USERS,
} from "../lib/demo-data";
import { ALL_PERMISSIONS, PERMISSION_LABELS, ROLE_PERMISSIONS } from "../lib/permissions";
import { seedCustomers } from "./seed-customers";
import { seedItems } from "./seed-items";
import { seedQuotes } from "./seed-quotes";
import { seedInvoices } from "./seed-invoices";
import { seedPayments } from "./seed-payments";
import { seedReminders } from "./seed-reminders";
import { seedSuppliers } from "./seed-suppliers";
import { seedSupplierInvoices } from "./seed-supplier-invoices";
import { cleanupAccountingModule, seedAccounting } from "./seed-accounting";
import { seedExportsDocuments } from "./seed-exports-documents";
import { seedSettings } from "./seed-settings";
import { seedSearch } from "./seed-search";

async function cleanupCommercialModules(prisma: PrismaClient, organizationId: string) {
  await prisma.supplierInvoiceActivity.deleteMany({ where: { organizationId } });
  await prisma.supplierInvoiceAttachment.deleteMany({ where: { organizationId } });
  await prisma.supplierInvoiceLine.deleteMany({ where: { organizationId } });
  await prisma.supplierInvoice.deleteMany({ where: { organizationId } });
  await prisma.expenseCategory.deleteMany({ where: { organizationId } });
  await prisma.reminderActivity.deleteMany({ where: { organizationId } });
  await prisma.reminderNote.deleteMany({ where: { organizationId } });
  await prisma.reminder.deleteMany({ where: { organizationId } });
  await prisma.reminderTemplate.deleteMany({ where: { organizationId } });
  await prisma.paymentActivity.deleteMany({ where: { organizationId } });
  await prisma.paymentAllocation.deleteMany({ where: { organizationId } });
  await prisma.payment.deleteMany({ where: { organizationId } });
  await prisma.creditNoteLine.deleteMany({ where: { organizationId } });
  await prisma.creditNote.deleteMany({ where: { organizationId } });
  await prisma.invoiceActivity.deleteMany({ where: { organizationId } });
  await prisma.invoiceLine.deleteMany({ where: { organizationId } });
  await prisma.invoice.deleteMany({ where: { organizationId } });
  await prisma.quoteActivity.deleteMany({ where: { organizationId } });
  await prisma.quoteLine.deleteMany({ where: { organizationId } });
  await prisma.quote.deleteMany({ where: { organizationId } });
}

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Permissions
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { name: PERMISSION_LABELS[key] },
      create: { key, name: PERMISSION_LABELS[key] },
    });
  }

  const permissions = await prisma.permission.findMany();
  const permissionMap = new Map(permissions.map((p) => [p.key, p.id]));

  // Roles
  const roleNames: Record<SystemRole, string> = {
    OWNER: "Propriétaire",
    ADMIN: "Administrateur",
    ACCOUNTANT: "Comptable",
    SALES: "Commercial",
    READ_ONLY: "Lecture seule",
  };

  for (const key of Object.keys(roleNames) as SystemRole[]) {
    await prisma.role.upsert({
      where: { key },
      update: { name: roleNames[key] },
      create: { key, name: roleNames[key] },
    });
  }

  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map((r) => [r.key, r]));

  // Role permissions
  for (const [roleKey, perms] of Object.entries(ROLE_PERMISSIONS) as [
    SystemRole,
    PermissionKey[],
  ][]) {
    const role = roleMap.get(roleKey)!;
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permKey of perms) {
      const permissionId = permissionMap.get(permKey)!;
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId },
      });
    }
  }

  // Organization & users (dev fixtures only)
  if (process.env.SEED_DEV_DATA !== "true") {
    console.log("✅ Bootstrap seed completed (roles & permissions).");
    console.log("   Pour charger des données d'exemple : SEED_DEV_DATA=true npm run db:seed");
    return;
  }

  console.log("📦 Chargement des fixtures de développement...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const org = await prisma.organization.upsert({
    where: { slug: DEMO_ORGANIZATION.slug },
    update: DEMO_ORGANIZATION,
    create: DEMO_ORGANIZATION,
  });

  // Users & memberships
  const ownerUser = await prisma.user.upsert({
    where: { email: DEMO_USERS[0].email },
    update: { name: DEMO_USERS[0].name, passwordHash },
    create: {
      email: DEMO_USERS[0].email,
      name: DEMO_USERS[0].name,
      passwordHash,
    },
  });

  for (const demoUser of DEMO_USERS) {
    const user = await prisma.user.upsert({
      where: { email: demoUser.email },
      update: { name: demoUser.name, passwordHash },
      create: {
        email: demoUser.email,
        name: demoUser.name,
        passwordHash,
      },
    });

    const role = roleMap.get(demoUser.role)!;
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: org.id,
          userId: user.id,
        },
      },
      update: {
        roleId: role.id,
        status: "ACTIVE",
        joinedAt: new Date("2025-01-15"),
      },
      create: {
        organizationId: org.id,
        userId: user.id,
        roleId: role.id,
        status: "ACTIVE",
        invitedById: ownerUser.id,
        joinedAt: new Date("2025-01-15"),
      },
    });
  }

  const allUsers = await prisma.user.findMany();

  // Numbering sequences
  for (const seq of DEMO_NUMBERING_SEQUENCES) {
    await prisma.numberingSequence.upsert({
      where: {
        organizationId_type: {
          organizationId: org.id,
          type: seq.type,
        },
      },
      update: {
        prefix: seq.prefix,
        nextNumber: seq.nextNumber,
        padding: seq.padding,
        suffix: seq.suffix,
        resetPeriod: seq.resetPeriod,
      },
      create: {
        organizationId: org.id,
        ...seq,
      },
    });
  }

  // Invitations en attente : créées via l'interface Équipe (plus de tokens de démo en seed)
  await prisma.auditLog.deleteMany({ where: { organizationId: org.id } });

  const auditEntries: {
    action: AuditAction;
    userId: string;
    entityType: string;
    entityLabel: string;
    daysAgo: number;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  }[] = [
    {
      action: "ORGANIZATION_CREATED",
      userId: ownerUser.id,
      entityType: "Organization",
      entityLabel: "Joey & Joey",
      daysAgo: 90,
    },
    {
      action: "USER_LOGIN",
      userId: ownerUser.id,
      entityType: "User",
      entityLabel: "owner@dev.local",
      daysAgo: 1,
    },
    {
      action: "USER_LOGIN",
      userId: allUsers.find((u) => u.email === "admin@dev.local")!.id,
      entityType: "User",
      entityLabel: "admin@dev.local",
      daysAgo: 2,
    },
    {
      action: "SETTINGS_UPDATED",
      userId: ownerUser.id,
      entityType: "Organization",
      entityLabel: "Joey & Joey",
      daysAgo: 30,
      oldValues: { defaultPaymentTermsDays: 15 },
      newValues: { defaultPaymentTermsDays: 30 },
    },
    {
      action: "ORGANIZATION_UPDATED",
      userId: allUsers.find((u) => u.email === "admin@dev.local")!.id,
      entityType: "Organization",
      entityLabel: "Joey & Joey",
      daysAgo: 25,
      oldValues: { phone: "+33 1 00 00 00 00" },
      newValues: { phone: "+33 1 23 45 67 89" },
    },
    {
      action: "MEMBER_INVITED",
      userId: ownerUser.id,
      entityType: "Invitation",
      entityLabel: "nouveau.commercial@dev.local",
      daysAgo: 10,
    },
    {
      action: "MEMBER_INVITED",
      userId: ownerUser.id,
      entityType: "Invitation",
      entityLabel: "externe.comptable@dev.local",
      daysAgo: 8,
    },
    {
      action: "MEMBER_ROLE_UPDATED",
      userId: allUsers.find((u) => u.email === "admin@dev.local")!.id,
      entityType: "OrganizationMember",
      entityLabel: "sales@dev.local",
      daysAgo: 20,
      oldValues: { role: "READ_ONLY" },
      newValues: { role: "SALES" },
    },
    {
      action: "NUMBERING_UPDATED",
      userId: ownerUser.id,
      entityType: "NumberingSequence",
      entityLabel: "INVOICE",
      daysAgo: 15,
      oldValues: { nextNumber: 40 },
      newValues: { nextNumber: 42 },
    },
    {
      action: "NUMBER_GENERATED",
      userId: allUsers.find((u) => u.email === "sales@dev.local")!.id,
      entityType: "NumberingSequence",
      entityLabel: "QUOTE → DEV-2026-0017",
      daysAgo: 5,
    },
    {
      action: "NUMBER_GENERATED",
      userId: allUsers.find((u) => u.email === "sales@dev.local")!.id,
      entityType: "NumberingSequence",
      entityLabel: "INVOICE → FAC-2026-0041",
      daysAgo: 4,
    },
    {
      action: "USER_LOGIN",
      userId: allUsers.find((u) => u.email === "accountant@dev.local")!.id,
      entityType: "User",
      entityLabel: "accountant@dev.local",
      daysAgo: 3,
    },
    {
      action: "USER_LOGIN",
      userId: allUsers.find((u) => u.email === "sales@dev.local")!.id,
      entityType: "User",
      entityLabel: "sales@dev.local",
      daysAgo: 2,
    },
    {
      action: "DEMO_LOGOUT",
      userId: allUsers.find((u) => u.email === "admin@dev.local")!.id,
      entityType: "User",
      entityLabel: "admin@dev.local",
      daysAgo: 1,
    },
    {
      action: "NUMBERING_UPDATED",
      userId: allUsers.find((u) => u.email === "admin@dev.local")!.id,
      entityType: "NumberingSequence",
      entityLabel: "CUSTOMER",
      daysAgo: 12,
      oldValues: { prefix: "C-" },
      newValues: { prefix: "CLI-" },
    },
    {
      action: "SETTINGS_UPDATED",
      userId: ownerUser.id,
      entityType: "Organization",
      entityLabel: "Joey & Joey",
      daysAgo: 7,
      oldValues: { primaryColor: "#1e40af" },
      newValues: { primaryColor: "#2563eb" },
    },
    {
      action: "MEMBER_SUSPENDED",
      userId: ownerUser.id,
      entityType: "OrganizationMember",
      entityLabel: "readonly@dev.local",
      daysAgo: 60,
      oldValues: { status: "ACTIVE" },
      newValues: { status: "SUSPENDED" },
    },
    {
      action: "MEMBER_REACTIVATED",
      userId: ownerUser.id,
      entityType: "OrganizationMember",
      entityLabel: "readonly@dev.local",
      daysAgo: 58,
      oldValues: { status: "SUSPENDED" },
      newValues: { status: "ACTIVE" },
    },
    {
      action: "NUMBER_GENERATED",
      userId: allUsers.find((u) => u.email === "accountant@dev.local")!.id,
      entityType: "NumberingSequence",
      entityLabel: "PAYMENT → REG-2026-0030",
      daysAgo: 6,
    },
    {
      action: "USER_LOGIN",
      userId: allUsers.find((u) => u.email === "readonly@dev.local")!.id,
      entityType: "User",
      entityLabel: "readonly@dev.local",
      daysAgo: 0,
    },
    {
      action: "ORGANIZATION_UPDATED",
      userId: ownerUser.id,
      entityType: "Organization",
      entityLabel: "Joey & Joey",
      daysAgo: 45,
      oldValues: { city: "Lyon" },
      newValues: { city: "Paris" },
    },
    {
      action: "NUMBER_GENERATED",
      userId: ownerUser.id,
      entityType: "NumberingSequence",
      entityLabel: "CUSTOMER → CLI-0023",
      daysAgo: 14,
    },
  ];

  for (const entry of auditEntries) {
    const createdAt = new Date();
    createdAt.setDate(createdAt.getDate() - entry.daysAgo);

    await prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityLabel: entry.entityLabel,
        oldValues: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        newValues: entry.newValues ? JSON.stringify(entry.newValues) : null,
        ipAddress: "127.0.0.1",
        userAgent: "JoeyJoey/1.0",
        createdAt,
      },
    });
  }

  await cleanupCommercialModules(prisma, org.id);

  await seedCustomers(prisma, org.id, ownerUser.id);
  await seedSuppliers(prisma, org.id, ownerUser.id);
  await seedSupplierInvoices(prisma, org.id, ownerUser.id);
  await seedItems(prisma, org.id, ownerUser.id);
  await seedQuotes(prisma, org.id, ownerUser.id);
  await seedInvoices(prisma, org.id, ownerUser.id);
  await seedPayments(prisma, org.id, ownerUser.id);
  await seedReminders(prisma, org.id, ownerUser.id);

  await cleanupAccountingModule(prisma, org.id);
  await seedAccounting(prisma, org.id, ownerUser.id);

  await seedSettings(prisma, org.id, ownerUser.id);

  await seedSearch(prisma, org.id, ownerUser.id);

  await seedExportsDocuments(prisma, org.id, ownerUser.id);

  console.log("✅ Seed completed successfully!");
  console.log(`   Organization: ${org.name} (${org.slug})`);
  console.log(`   Users: ${DEMO_USERS.length}`);
  console.log(`   Audit logs: ${auditEntries.length}`);
  console.log(`   Password: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
