import {
  PrismaClient,
  ReminderActivityType,
  ReminderLevel,
  ReminderStatus,
  ReminderNoteType,
} from "@prisma/client";
import { getDaysOverdue, getRecommendedReminderLevel } from "../lib/collection-utils";
import {
  buildTemplateVariables,
  DEFAULT_REMINDER_TEMPLATES,
  renderReminderTemplate,
} from "../lib/reminder-templates";

const LEVEL_DISTRIBUTION: ReminderLevel[] = [
  ...Array(15).fill("FRIENDLY"),
  ...Array(12).fill("FIRST_NOTICE"),
  ...Array(10).fill("SECOND_NOTICE"),
  ...Array(8).fill("FINAL_NOTICE"),
] as ReminderLevel[];

const STATUS_DISTRIBUTION: ReminderStatus[] = [
  ...Array(40).fill("SIMULATED_SENT"),
  ...Array(3).fill("DRAFT"),
  ...Array(2).fill("CANCELLED"),
] as ReminderStatus[];

const NOTE_SAMPLES: { type: ReminderNoteType; content: string }[] = [
  { type: "CALL", content: "Client contacté par téléphone, règlement prévu vendredi." },
  { type: "DISPUTE", content: "Litige sur une ligne de facture, en attente de correction." },
  { type: "PROMISE_TO_PAY", content: "Promesse de paiement reçue pour la semaine prochaine." },
  { type: "INTERNAL", content: "Relance suspendue temporairement à la demande du commercial." },
  { type: "GENERAL", content: "Client demande un duplicata de facture." },
  { type: "EMAIL", content: "Email de relance simulé — aucun envoi réel." },
];

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function seedReminders(
  prisma: PrismaClient,
  organizationId: string,
  userId: string,
) {
  console.log("  Seeding reminders...");

  await prisma.reminderActivity.deleteMany({ where: { organizationId } });
  await prisma.reminderNote.deleteMany({ where: { organizationId } });
  await prisma.reminder.deleteMany({ where: { organizationId } });
  await prisma.reminderTemplate.deleteMany({ where: { organizationId } });

  for (const t of DEFAULT_REMINDER_TEMPLATES) {
    await prisma.reminderTemplate.create({
      data: {
        organizationId,
        name: t.name,
        level: t.level,
        subject: t.subject,
        message: t.message,
        isDefault: true,
        isActive: true,
      },
    });
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  const templates = await prisma.reminderTemplate.findMany({ where: { organizationId } });

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      isArchived: false,
      status: { notIn: ["DRAFT", "PAID", "CANCELLED", "CREDITED"] },
      amountDue: { gt: 0 },
    },
    include: { customer: true },
    orderBy: { issueDate: "asc" },
  });

  if (invoices.length === 0) {
    console.warn("  ⚠ Skipping reminders seed");
    return;
  }

  const overdueBuckets = [
    { min: 1, max: 7, count: 10 },
    { min: 8, max: 30, count: 12 },
    { min: 31, max: 60, count: 8 },
    { min: 61, max: 120, count: 5 },
  ];

  let bucketIdx = 0;
  let inBucket = 0;
  const eligibleInvoices: typeof invoices = [];

  for (let i = 0; i < invoices.length && bucketIdx < overdueBuckets.length; i++) {
    const bucket = overdueBuckets[bucketIdx];
    const inv = invoices[i];
    const overdueDays = bucket.min + (inBucket % (bucket.max - bucket.min + 1));
    const dueDate = daysAgo(overdueDays);
    const issueDate = addDays(dueDate, -30);

    await prisma.invoice.update({
      where: { id: inv.id },
      data: {
        dueDate,
        issueDate,
        status: inv.status === "VALIDATED" || inv.status === "SENT" ? "OVERDUE" : inv.status,
        paymentStatus: "OVERDUE",
        reminderStatus: "TO_REMIND",
      },
    });

    eligibleInvoices.push({ ...inv, dueDate, issueDate });
    inBucket++;
    if (inBucket >= bucket.count) {
      bucketIdx++;
      inBucket = 0;
    }
  }

  // Litiges, pauses, promesses
  const special = eligibleInvoices.slice(0, 12);
  for (let i = 0; i < 4 && i < special.length; i++) {
    await prisma.invoice.update({
      where: { id: special[i].id },
      data: {
        isDisputed: true,
        disputeReason: "Contestations sur le montant ou la prestation",
        reminderStatus: "DISPUTED",
      },
    });
  }
  for (let i = 4; i < 7 && i < special.length; i++) {
    await prisma.invoice.update({
      where: { id: special[i].id },
      data: {
        isCollectionPaused: true,
        collectionPausedReason: "Suspension temporaire à la demande du commercial",
        reminderStatus: "PAUSED",
      },
    });
  }
  for (let i = 7; i < 12 && i < special.length; i++) {
    await prisma.invoice.update({
      where: { id: special[i].id },
      data: {
        promisedPaymentDate: addDays(new Date(), 7 + i),
        reminderStatus: "TO_REMIND",
      },
    });
  }

  let activityCount = 0;
  let noteCount = 0;

  for (let i = 0; i < 45; i++) {
    const inv = eligibleInvoices[i % eligibleInvoices.length];
    const fresh = await prisma.invoice.findUnique({ where: { id: inv.id } });
    if (!fresh || fresh.isDisputed || fresh.isCollectionPaused) continue;

    const level = LEVEL_DISTRIBUTION[i];
    const status = STATUS_DISTRIBUTION[i];
    const daysOverdue = getDaysOverdue(fresh.dueDate);
    const template = templates.find((t) => t.level === level && t.isDefault) ?? templates[0];
    const vars = buildTemplateVariables({
      customerName: inv.customer.name,
      invoiceNumber: fresh.invoiceNumber,
      dueDate: fresh.dueDate,
      amountDue: fresh.amountDue,
      currency: fresh.currency,
      daysOverdue,
      organizationName: org?.name ?? "Joey & Joey",
      includePaymentLink: true,
    });

    const reminderNumber = `REL-2026-${String(i + 1).padStart(4, "0")}`;
    const sentAt = status === "SIMULATED_SENT" ? daysAgo(30 - (i % 25)) : null;

    const reminder = await prisma.reminder.create({
      data: {
        organizationId,
        reminderNumber,
        customerId: fresh.customerId,
        invoiceId: fresh.id,
        status,
        level,
        channel: "EMAIL",
        recipientEmail: inv.customer.email ?? "contact@dev.local",
        subject: renderReminderTemplate(template.subject, vars),
        message: renderReminderTemplate(template.message, vars),
        simulatedSentAt: sentAt,
        dueDate: fresh.dueDate,
        invoiceIssueDate: fresh.issueDate,
        invoiceTotalIncludingTax: fresh.totalIncludingTax,
        invoiceAmountPaid: fresh.amountPaid,
        invoiceAmountDue: fresh.amountDue,
        daysOverdue,
        includePaymentLinkPlaceholder: true,
        internalNotes: i % 6 === 0 ? "Relance fictive" : null,
        createdById: userId,
      },
    });

    const activities: { type: ReminderActivityType; title: string; description?: string }[] = [
      { type: "CREATED", title: "Relance créée" },
    ];
    if (status === "SIMULATED_SENT") {
      activities.push({ type: "EMAIL_SIMULATED", title: "Email simulé", description: inv.customer.email ?? "" });
      activities.push({ type: "TEMPLATE_APPLIED", title: "Modèle appliqué", description: template.name });
    }
    if (status === "CANCELLED") {
      activities.push({ type: "CANCELLED", title: "Relance annulée" });
    }
    if (i % 4 === 0) {
      activities.push({ type: "NOTE", title: "Note interne ajoutée", description: "Suivi recouvrement" });
    }
    if (i % 7 === 0 && status === "SIMULATED_SENT") {
      activities.push({ type: "PAYMENT_LINK_PLACEHOLDER_ADDED", title: "Lien paiement ajouté" });
    }

    for (const act of activities) {
      await prisma.reminderActivity.create({
        data: {
          organizationId,
          reminderId: reminder.id,
          userId,
          type: act.type,
          title: act.title,
          description: act.description ?? null,
        },
      });
      activityCount++;
    }

    if (status === "SIMULATED_SENT") {
      await prisma.invoice.update({
        where: { id: fresh.id },
        data: {
          lastReminderAt: sentAt,
          lastReminderLevel: level,
          reminderCount: { increment: 1 },
          reminderStatus: "REMINDED",
        },
      });
    }
  }

  for (let i = 0; i < 35; i++) {
    const inv = eligibleInvoices[i % eligibleInvoices.length];
    const sample = NOTE_SAMPLES[i % NOTE_SAMPLES.length];
    await prisma.reminderNote.create({
      data: {
        organizationId,
        customerId: inv.customerId,
        invoiceId: inv.id,
        userId,
        type: sample.type,
        content: sample.content,
      },
    });
    noteCount++;
  }

  const createdReminders = await prisma.reminder.findMany({
    where: { organizationId },
    select: { id: true },
    take: 20,
  });
  const extraTitles = [
    "Relance relue",
    "Destinataire vérifié",
    "Montant confirmé",
    "Suivi commercial",
    "Rappel planifié",
    "Historique mis à jour",
    "Modèle personnalisé",
  ];
  for (let i = activityCount; i < 80 && i - activityCount < createdReminders.length; i++) {
    const reminder = createdReminders[(i - activityCount) % createdReminders.length];
    await prisma.reminderActivity.create({
      data: {
        organizationId,
        reminderId: reminder.id,
        userId,
        type: "UPDATED",
        title: extraTitles[i % extraTitles.length],
        description: "Activité fictive",
      },
    });
    activityCount++;
  }

  console.log(`  ✓ 4 templates, 45 reminders, ${activityCount} activities, ${noteCount} notes`);
}
