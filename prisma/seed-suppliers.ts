import {
  PrismaClient,
  SupplierActivityType,
  SupplierRiskLevel,
  SupplierStatus,
  SupplierType,
} from "@prisma/client";

const SUPPLIER_NAMES = [
  "Bureau Plus Services",
  "HexaCloud Solutions",
  "Transport Mercure",
  "Print Factory",
  "Conseil Atlas",
  "Maintenance Horizon",
  "Fournitures Delta",
  "Web Studio Nord",
  "DataSecure Demo",
  "Telecom Express",
  "Atelier Réseau",
  "Propreté Urbaine",
  "Matériel Office",
  "Média Concept",
  "Logiciels Agora",
  "Formation Expertis",
  "Assistance Technique Sud",
  "Livraison Rapide Demo",
  "Design Partner",
  "Conseil Fiscalis",
  "Support Informatique Central",
  "Énergie Bureau Demo",
  "Archivage Numérique Plus",
  "Cloud Backup Services",
  "Traduction Business Demo",
];

const CATEGORIES = [
  { name: "Services généraux", color: "#64748b", sortOrder: 1 },
  { name: "Informatique", color: "#2563eb", sortOrder: 2 },
  { name: "Logiciels", color: "#7c3aed", sortOrder: 3 },
  { name: "Télécommunications", color: "#0891b2", sortOrder: 4 },
  { name: "Transport", color: "#d97706", sortOrder: 5 },
  { name: "Marketing", color: "#db2777", sortOrder: 6 },
  { name: "Conseil", color: "#059669", sortOrder: 7 },
  { name: "Fournitures", color: "#475569", sortOrder: 8 },
  { name: "Maintenance", color: "#ca8a04", sortOrder: 9 },
  { name: "Sous-traitance", color: "#9333ea", sortOrder: 10 },
];

const TAGS = [
  { name: "Stratégique", color: "#7c3aed" },
  { name: "Préféré", color: "#2563eb" },
  { name: "Nouveau", color: "#059669" },
  { name: "À surveiller", color: "#d97706" },
  { name: "Risque", color: "#dc2626" },
  { name: "Contrat annuel", color: "#0891b2" },
  { name: "Support", color: "#64748b" },
  { name: "International", color: "#db2777" },
];

const CITIES = ["Paris", "Lyon", "Marseille", "Bordeaux", "Lille", "Nantes", "Toulouse", "Strasbourg"];

const ACTIVITY_TEMPLATES: { type: SupplierActivityType; title: string; amount?: number }[] = [
  { type: "CALL", title: "Appel de suivi fournisseur" },
  { type: "EMAIL", title: "Email de relance envoyé" },
  { type: "MEETING", title: "Réunion de suivi fournisseur" },
  { type: "SUPPLIER_INVOICE_PLACEHOLDER", title: "Facture fournisseur fictive enregistrée", amount: 2400 },
  { type: "PAYMENT_PLACEHOLDER", title: "Paiement fournisseur fictif simulé", amount: 1800 },
  { type: "DOCUMENT_ADDED_PLACEHOLDER", title: "Document fournisseur fictif ajouté" },
  { type: "PURCHASE_ORDER_PLACEHOLDER", title: "Bon de commande fictif créé", amount: 3200 },
  { type: "NOTE", title: "Note interne fournisseur" },
];

const NOTE_SAMPLES = [
  "Client contacté par téléphone, règlement prévu vendredi.",
  "Litige sur une ligne de facture, en attente de correction.",
  "Promesse de paiement reçue pour la semaine prochaine.",
  "Relance suspendue temporairement à la demande du commercial.",
  "Client demande un duplicata de facture.",
];

function statusForIndex(i: number): SupplierStatus {
  if (i >= 23) return "ARCHIVED";
  if (i >= 18) return "INACTIVE";
  return "ACTIVE";
}

function riskForIndex(i: number): SupplierRiskLevel {
  if (i < 3 || i === 10 || i === 19) return "HIGH";
  if (i % 4 === 0) return "MEDIUM";
  return "LOW";
}

export async function seedSuppliers(
  prisma: PrismaClient,
  organizationId: string,
  ownerUserId: string,
) {
  console.log("  Seeding suppliers...");

  await prisma.supplierActivity.deleteMany({ where: { organizationId } });
  await prisma.supplierNote.deleteMany({ where: { organizationId } });
  await prisma.supplierTagAssignment.deleteMany({ where: { organizationId } });
  await prisma.supplierBankAccount.deleteMany({ where: { organizationId } });
  await prisma.supplierContact.deleteMany({ where: { organizationId } });
  await prisma.supplierAddress.deleteMany({ where: { organizationId } });
  await prisma.supplier.deleteMany({ where: { organizationId } });
  await prisma.supplierTag.deleteMany({ where: { organizationId } });
  await prisma.supplierCategory.deleteMany({ where: { organizationId } });

  const categoryRecords = [];
  for (const cat of CATEGORIES) {
    categoryRecords.push(
      await prisma.supplierCategory.create({
        data: { organizationId, ...cat, description: `${cat.name}` },
      }),
    );
  }

  const tagRecords = [];
  for (const tag of TAGS) {
    tagRecords.push(await prisma.supplierTag.create({ data: { organizationId, ...tag } }));
  }

  const suppliers = [];
  let activityCount = 0;
  let noteCount = 0;
  let contactCount = 0;
  let addressCount = 0;
  let bankCount = 0;

  for (let i = 0; i < SUPPLIER_NAMES.length; i++) {
    const name = SUPPLIER_NAMES[i];
    const status = statusForIndex(i);
    const isArchived = status === "ARCHIVED";
    const riskLevel = riskForIndex(i);
    const isPreferred = i < 6;
    const city = CITIES[i % CITIES.length];
    const num = String(i + 1).padStart(4, "0");
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "");

    const supplier = await prisma.supplier.create({
      data: {
        organizationId,
        supplierNumber: `FOU-${num}`,
        type: i === 4 ? SupplierType.INDIVIDUAL : SupplierType.COMPANY,
        status,
        name,
        legalName: `${name} SAS`,
        displayName: name,
        email: `achats@${slug}.demo`,
        phone: `+33 4 ${String(10 + (i % 80)).padStart(2, "0")} ${String(20 + i).padStart(2, "0")} ${String(30 + i).padStart(2, "0")} ${String(40 + i).padStart(2, "0")}`,
        website: `https://${slug}.demo`,
        siret: `${String(20000000000000 + i * 1111).slice(0, 14)}`,
        vatNumber: `FR${String(20 + i).padStart(2, "0")}${String(200000000 + i).slice(0, 9)}`,
        legalForm: i === 4 ? "EI" : "SAS",
        industry: CATEGORIES[i % CATEGORIES.length].name,
        categoryId: categoryRecords[i % categoryRecords.length].id,
        defaultPaymentTermsDays: 30 + (i % 3) * 15,
        defaultVatRate: 20,
        currency: "EUR",
        outstandingAmount: Math.round((800 + i * 420) * 100) / 100,
        totalPurchasesAmount: Math.round((12000 + i * 3500) * 100) / 100,
        riskLevel,
        isPreferred,
        notes: i % 4 === 0 ? "Fournisseur exemple — données fictives." : null,
        isArchived,
        archivedAt: isArchived ? new Date("2025-10-15") : null,
        createdAt: new Date(Date.now() - (25 - i) * 5 * 24 * 60 * 60 * 1000),
      },
    });
    suppliers.push(supplier);

    await prisma.supplierAddress.create({
      data: {
        organizationId,
        supplierId: supplier.id,
        type: "HEADQUARTERS",
        label: "Siège",
        addressLine1: `${20 + i} avenue des Fournisseurs`,
        postalCode: String(69000 + (i % 20) * 100).slice(0, 5),
        city,
        region: city === "Paris" ? "Île-de-France" : undefined,
        country: "FR",
        isDefault: true,
      },
    });
    addressCount++;

    if (i % 2 === 0) {
      await prisma.supplierAddress.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          type: "BILLING",
          label: "Facturation",
          addressLine1: `${5 + i} rue Comptable`,
          postalCode: String(75000 + i).slice(0, 5),
          city,
          country: "FR",
          isDefault: false,
        },
      });
      addressCount++;
    }

    const contactsForSupplier = i % 3 === 0 ? 2 : 1;
    for (let c = 0; c < contactsForSupplier; c++) {
      await prisma.supplierContact.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          firstName: ["Marie", "Thomas", "Sophie", "Lucas"][c % 4],
          lastName: ["Bernard", "Petit", "Moreau", "Girard"][(i + c) % 4],
          jobTitle: c === 0 ? "Responsable achats" : "Assistant(e) administratif(ve)",
          email: `contact${c + 1}@${slug}.demo`,
          phone: `+33 6 ${String(12 + i + c).padStart(2, "0")} ${String(34 + i).padStart(2, "0")} ${String(56 + i).padStart(2, "0")} ${String(78 + i).padStart(2, "0")}`,
          isPrimary: c === 0,
        },
      });
      contactCount++;
    }

    if (i % 2 === 0) {
      await prisma.supplierBankAccount.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          label: "Compte principal fictif",
          iban: `FR76 0000 0000 0000 0000 0000 ${String(i + 1).padStart(3, "0")}`,
          bic: "SANDBOXXX",
          bankName: "Banque Démo",
          accountHolder: name,
          isDefault: true,
          isActive: true,
        },
      });
      bankCount++;
    }
    if (i % 5 === 0) {
      await prisma.supplierBankAccount.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          label: "Compte secondaire fictif",
          iban: `FR76 0000 0000 0000 0000 0001 ${String(i + 1).padStart(3, "0")}`,
          bic: "SANDBOXYY",
          bankName: "Banque Sandbox",
          accountHolder: name,
          isDefault: false,
          isActive: true,
        },
      });
      bankCount++;
    }

    for (let t = 0; t < 2; t++) {
      const tag = tagRecords[(i + t) % tagRecords.length];
      await prisma.supplierTagAssignment.create({
        data: { organizationId, supplierId: supplier.id, tagId: tag.id },
      });
    }

    for (let n = 0; n < (i % 3 === 0 ? 2 : 1); n++) {
      await prisma.supplierNote.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          userId: ownerUserId,
          content: NOTE_SAMPLES[(i + n) % NOTE_SAMPLES.length],
        },
      });
      noteCount++;
    }

    const actCount = i % 4 === 0 ? 3 : 2;
    for (let a = 0; a < actCount; a++) {
      const tpl = ACTIVITY_TEMPLATES[(i + a) % ACTIVITY_TEMPLATES.length];
      await prisma.supplierActivity.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          type: tpl.type,
          title: tpl.title,
          amount: tpl.amount ?? null,
          activityDate: new Date(Date.now() - (a + 1) * 7 * 24 * 60 * 60 * 1000),
        },
      });
      activityCount++;
    }

    await prisma.supplierActivity.create({
      data: {
        organizationId,
        supplierId: supplier.id,
        type: "SUPPLIER_CREATED",
        title: "Fournisseur créé",
        activityDate: supplier.createdAt,
      },
    });
    activityCount++;
  }

  while (activityCount < 60) {
    const supplier = suppliers[activityCount % suppliers.length];
    await prisma.supplierActivity.create({
      data: {
        organizationId,
        supplierId: supplier.id,
        type: "EMAIL",
        title: "Relance fournisseur fictive",
        activityDate: new Date(Date.now() - activityCount * 86400000),
      },
    });
    activityCount++;
  }

  while (noteCount < 30) {
    const supplier = suppliers[noteCount % suppliers.length];
    await prisma.supplierNote.create({
      data: {
        organizationId,
        supplierId: supplier.id,
        userId: ownerUserId,
        content: NOTE_SAMPLES[noteCount % NOTE_SAMPLES.length],
      },
    });
    noteCount++;
  }

  console.log(
    `  ✓ ${suppliers.length} suppliers, ${contactCount} contacts, ${addressCount} addresses, ${bankCount} bank accounts, ${noteCount} notes, ${activityCount} activities, ${categoryRecords.length} categories, ${tagRecords.length} tags`,
  );
}
