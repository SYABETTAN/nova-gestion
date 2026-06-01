import {
  CustomerActivityType,
  CustomerStatus,
  CustomerType,
  PrismaClient,
} from "@prisma/client";

const CUSTOMER_NAMES = [
  "Atelier Lumière SAS",
  "Horizon Conseil",
  "Boulangerie Martin",
  "Cabinet Durand & Associés",
  "GreenTech Solutions",
  "Alpha Distribution",
  "Maison Rivage",
  "Studio Pixel",
  "Clinique Saint-Roch",
  "Urban Mobilité",
  "Éditions du Canal",
  "Hôtel Bellevue",
  "Nova Formation",
  "Agence Boréale",
  "Comptoir des Saveurs",
  "Bleu Digital",
  "Garage Central",
  "MédiPlus Services",
  "Synapse Analytics",
  "Énergie Locale",
  "Atelier du Bois",
  "Transport Lefèvre",
  "DataCraft Studio",
  "Fleur & Co",
  "Institut Harmonie",
];

const TAGS = [
  { name: "VIP", color: "#7c3aed" },
  { name: "Grand compte", color: "#2563eb" },
  { name: "Nouveau", color: "#059669" },
  { name: "Relance", color: "#d97706" },
  { name: "Risque", color: "#dc2626" },
  { name: "Partenaire", color: "#0891b2" },
  { name: "Startup", color: "#db2777" },
  { name: "Administration", color: "#475569" },
];

const CITIES = [
  "Paris", "Lyon", "Marseille", "Bordeaux", "Lille", "Nantes", "Toulouse", "Strasbourg",
];

const ACTIVITY_TEMPLATES: { type: CustomerActivityType; title: string; amount?: number }[] = [
  { type: "CALL", title: "Appel de qualification" },
  { type: "EMAIL", title: "Email de présentation envoyé" },
  { type: "MEETING", title: "Réunion de découverte" },
  { type: "QUOTE_CREATED", title: "Devis DEV-2026-0012 créé", amount: 4500 },
  { type: "QUOTE_ACCEPTED", title: "Devis DEV-2026-0008 accepté", amount: 8200 },
  { type: "INVOICE_SENT", title: "Facture FAC-2026-0031 envoyée", amount: 3200 },
  { type: "PAYMENT_RECEIVED", title: "Paiement de 1 250 € reçu", amount: 1250 },
  { type: "REMINDER_SENT", title: "Relance envoyée" },
  { type: "NOTE", title: "Note commerciale interne" },
];

function statusForIndex(i: number): CustomerStatus {
  if (i === 24) return "ARCHIVED";
  if (i < 8) return "PROSPECT";
  if (i < 22) return "ACTIVE";
  return "INACTIVE";
}

export async function seedCustomers(
  prisma: PrismaClient,
  organizationId: string,
  ownerUserId: string,
) {
  console.log("   Seeding customers...");

  await prisma.customerActivity.deleteMany({ where: { organizationId } });
  await prisma.customerNote.deleteMany({ where: { organizationId } });
  await prisma.customerTagAssignment.deleteMany({ where: { organizationId } });
  await prisma.customerContact.deleteMany({ where: { organizationId } });
  await prisma.customerAddress.deleteMany({ where: { organizationId } });
  await prisma.customer.deleteMany({ where: { organizationId } });
  await prisma.customerTag.deleteMany({ where: { organizationId } });

  const tagRecords = [];
  for (const tag of TAGS) {
    const record = await prisma.customerTag.create({
      data: { organizationId, ...tag },
    });
    tagRecords.push(record);
  }

  const customers = [];

  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const name = CUSTOMER_NAMES[i];
    const status = statusForIndex(i);
    const isArchived = status === "ARCHIVED";
    const city = CITIES[i % CITIES.length];
    const num = String(i + 1).padStart(4, "0");

    const customer = await prisma.customer.create({
      data: {
        organizationId,
        customerNumber: `CLI-${num}`,
        type: i === 2 ? CustomerType.INDIVIDUAL : CustomerType.COMPANY,
        status,
        name,
        legalName: `${name}${i === 2 ? "" : " SAS"}`,
        displayName: name,
        email: `contact${i + 1}@${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.demo`,
        phone: `+33 1 ${String(10 + (i % 80)).padStart(2, "0")} ${String(20 + i).padStart(2, "0")} ${String(30 + i).padStart(2, "0")} ${String(40 + i).padStart(2, "0")}`,
        website: `https://${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}.demo`,
        siret: `${String(10000000000000 + i * 1111).slice(0, 14)}`,
        vatNumber: `FR${String(12 + i).padStart(2, "0")}${String(100000000 + i).slice(0, 9)}`,
        legalForm: i === 2 ? "EI" : "SAS",
        industry: ["Conseil", "Retail", "Tech", "Santé", "Transport", "Hôtellerie"][i % 6],
        employeeCount: 5 + i * 3,
        annualRevenue: 50000 + i * 25000,
        defaultPaymentTermsDays: 30,
        defaultVatRate: 20,
        currency: "EUR",
        creditLimit: 5000 + i * 1000,
        outstandingAmount: Math.round((500 + i * 350) * 100) / 100,
        notes: i % 3 === 0 ? "Client exemple — données fictives." : null,
        isArchived,
        archivedAt: isArchived ? new Date("2025-11-01") : null,
        createdAt: new Date(Date.now() - (25 - i) * 7 * 24 * 60 * 60 * 1000),
      },
    });

    customers.push(customer);

    await prisma.customerAddress.create({
      data: {
        organizationId,
        customerId: customer.id,
        type: "BILLING",
        label: "Siège",
        addressLine1: `${10 + i} rue de la République`,
        postalCode: String(75000 + (i % 20) * 100).slice(0, 5),
        city,
        region: city === "Paris" ? "Île-de-France" : undefined,
        country: "FR",
        isDefault: true,
      },
    });

    await prisma.customerAddress.create({
      data: {
        organizationId,
        customerId: customer.id,
        type: "SHIPPING",
        label: i % 2 === 0 ? "Livraison" : "Entrepôt",
        addressLine1: `${20 + i} avenue des Champs`,
        postalCode: String(69000 + i * 10).slice(0, 5),
        city: CITIES[(i + 2) % CITIES.length],
        country: "FR",
        isDefault: i % 2 === 0,
      },
    });

    if (i % 3 === 0) {
      await prisma.customerAddress.create({
        data: {
          organizationId,
          customerId: customer.id,
          type: "OTHER",
          label: "Site secondaire",
          addressLine1: `${30 + i} boulevard Central`,
          postalCode: String(33000 + i * 5).slice(0, 5),
          city: CITIES[(i + 4) % CITIES.length],
          country: "FR",
          isDefault: false,
        },
      });
    }

    const contactCount = i % 4 === 0 ? 3 : i % 2 === 0 ? 2 : 1;
    for (let c = 0; c < contactCount; c++) {
      await prisma.customerContact.create({
        data: {
          organizationId,
          customerId: customer.id,
          firstName: ["Marie", "Thomas", "Sophie", "Lucas", "Emma"][c % 5],
          lastName: ["Dupont", "Bernard", "Petit", "Moreau", "Laurent"][i % 5],
          jobTitle: c === 0 ? "Directeur général" : "Responsable achats",
          email: `contact${c + 1}.${i + 1}@example.com`,
          phone: `+33 6 ${String(10 + i).padStart(2, "0")} ${String(20 + c).padStart(2, "0")} ${String(30 + i).padStart(2, "0")} ${String(40 + c).padStart(2, "0")}`,
          isPrimary: c === 0,
        },
      });
    }

    const tagIndexes = [i % 8, (i + 2) % 8];
    for (const ti of tagIndexes) {
      await prisma.customerTagAssignment.create({
        data: {
          organizationId,
          customerId: customer.id,
          tagId: tagRecords[ti].id,
        },
      });
    }

    if (i % 2 === 0 || i % 3 === 0) {
      await prisma.customerNote.create({
        data: {
          organizationId,
          customerId: customer.id,
          userId: ownerUserId,
          content: `Note interne pour ${name} — suivi commercial fictif.`,
        },
      });
    }
    if (i % 5 === 0) {
      await prisma.customerNote.create({
        data: {
          organizationId,
          customerId: customer.id,
          userId: ownerUserId,
          content: `Relance prévue — client ${name} à contacter cette semaine.`,
        },
      });
    }
  }

  let activityCount = 0;
  for (const customer of customers) {
    const activityNum = 2 + (customers.indexOf(customer) % 3);
    for (let a = 0; a < activityNum; a++) {
      const template = ACTIVITY_TEMPLATES[(customers.indexOf(customer) + a) % ACTIVITY_TEMPLATES.length];
      const activityDate = new Date();
      activityDate.setDate(activityDate.getDate() - (a + 1) * 7);

      await prisma.customerActivity.create({
        data: {
          organizationId,
          customerId: customer.id,
          type: template.type,
          title: template.title,
          description: "Activité fictive exemple — en attente des modules devis/factures.",
          amount: template.amount ?? null,
          activityDate,
        },
      });
      activityCount++;
    }
  }

  await prisma.numberingSequence.updateMany({
    where: { organizationId, type: "CUSTOMER" },
    data: { nextNumber: 26 },
  });

  console.log(`   ✓ ${customers.length} clients, ${activityCount}+ activités, ${TAGS.length} tags`);
}
