import {
  ItemActivityType,
  ItemStatus,
  ItemType,
  PrismaClient,
  RecurringInterval,
} from "@prisma/client";
import { computeItemPricing } from "../lib/pricing";
import { moneyMul, moneyToNumber, toDbDecimal } from "../lib/money";
import { ITEM_MONEY_FIELDS, mapMoneyFieldsToDb } from "../lib/money-db";

const SERVICE_NAMES = [
  "Audit de gestion commerciale",
  "Paramétrage initial logiciel",
  "Formation utilisateurs",
  "Support mensuel standard",
  "Support mensuel premium",
  "Maintenance corrective",
  "Atelier reporting financier",
  "Accompagnement facturation",
  "Migration de données",
  "Conseil optimisation process",
  "Formation administrateur",
  "Pack onboarding PME",
  "Abonnement plateforme Basic",
  "Abonnement plateforme Pro",
  "Abonnement plateforme Business",
  "Intervention technique à distance",
  "Intervention sur site",
  "Création modèle facture",
  "Paramétrage TVA",
  "Revue mensuelle de gestion",
  "Pack support prioritaire",
  "Accompagnement relances clients",
  "Paramétrage export comptable",
  "Audit processus internes",
];

const PRODUCT_NAMES = [
  "Licence utilisateur standard",
  "Licence utilisateur avancée",
  "Module reporting",
  "Module synchronisation bancaire",
  "Module export comptable",
  "Pack connecteurs",
  "Scanner documents compact",
  "Terminal de saisie mobile",
  "Kit démarrage PME",
  "Pack modèles PDF",
  "Add-on relances clients",
  "Add-on tableaux de bord",
  "Add-on gestion fournisseurs",
  "Connecteur e-commerce",
  "Connecteur CRM",
  "Formation vidéo complète",
];

const CATEGORIES = [
  { name: "Services récurrents", color: "#2563eb", sortOrder: 1 },
  { name: "Prestations ponctuelles", color: "#0891b2", sortOrder: 2 },
  { name: "Conseil", color: "#7c3aed", sortOrder: 3 },
  { name: "Formation", color: "#059669", sortOrder: 4 },
  { name: "Logiciel", color: "#db2777", sortOrder: 5 },
  { name: "Matériel", color: "#d97706", sortOrder: 6 },
  { name: "Maintenance", color: "#64748b", sortOrder: 7 },
  { name: "Abonnements", color: "#4f46e5", sortOrder: 8 },
  { name: "Support", color: "#0d9488", sortOrder: 9 },
  { name: "Frais annexes", color: "#475569", sortOrder: 10 },
];

const UNITS = [
  { name: "Unité", symbol: "u", isDefault: true },
  { name: "Heure", symbol: "h", isDefault: false },
  { name: "Jour", symbol: "j", isDefault: false },
  { name: "Mois", symbol: "mois", isDefault: false },
  { name: "Forfait", symbol: "forfait", isDefault: false },
  { name: "Licence", symbol: "licence", isDefault: false },
  { name: "Utilisateur", symbol: "utilisateur", isDefault: false },
  { name: "Intervention", symbol: "intervention", isDefault: false },
];

const TAGS = [
  { name: "Populaire", color: "#2563eb" },
  { name: "Premium", color: "#7c3aed" },
  { name: "Nouveau", color: "#059669" },
  { name: "À promouvoir", color: "#d97706" },
  { name: "Faible marge", color: "#dc2626" },
  { name: "Forte marge", color: "#16a34a" },
  { name: "Récurrent", color: "#0891b2" },
  { name: "Interne", color: "#64748b" },
];

function statusForIndex(i: number): ItemStatus {
  if (i >= 38) return "ARCHIVED";
  if (i >= 35) return "INACTIVE";
  if (i >= 30) return "DRAFT";
  return "ACTIVE";
}

export async function seedItems(
  prisma: PrismaClient,
  organizationId: string,
  ownerUserId: string,
) {
  console.log("   Seeding items catalogue...");

  await prisma.itemActivity.deleteMany({ where: { organizationId } });
  await prisma.itemPriceHistory.deleteMany({ where: { organizationId } });
  await prisma.itemTagAssignment.deleteMany({ where: { organizationId } });
  await prisma.item.deleteMany({ where: { organizationId } });
  await prisma.itemTag.deleteMany({ where: { organizationId } });
  await prisma.itemCategory.deleteMany({ where: { organizationId } });
  await prisma.itemUnit.deleteMany({ where: { organizationId } });

  const categories = [];
  for (const cat of CATEGORIES) {
    categories.push(
      await prisma.itemCategory.create({ data: { organizationId, ...cat } }),
    );
  }

  const units = [];
  for (const unit of UNITS) {
    units.push(await prisma.itemUnit.create({ data: { organizationId, ...unit } }));
  }

  const tags = [];
  for (const tag of TAGS) {
    tags.push(await prisma.itemTag.create({ data: { organizationId, ...tag } }));
  }

  const allNames = [
    ...SERVICE_NAMES.map((name) => ({ name, type: ItemType.SERVICE })),
    ...PRODUCT_NAMES.map((name) => ({ name, type: ItemType.PRODUCT })),
  ];

  const items = [];

  for (let i = 0; i < allNames.length; i++) {
    const { name, type } = allNames[i];
    const status = statusForIndex(i);
    const isArchived = status === "ARCHIVED";
    const saleHT = 50 + i * 45 + (type === ItemType.PRODUCT ? 100 : 0);
    const purchaseHT = Math.round(saleHT * (0.3 + (i % 5) * 0.08));
    const vatRate = i % 7 === 0 ? 10 : 20;
    const pricing = computeItemPricing({
      salePriceExcludingTax: saleHT,
      purchasePriceExcludingTax: purchaseHT,
      defaultVatRate: vatRate,
    });

    const isRecurring =
      type === ItemType.SERVICE &&
      (name.includes("Abonnement") ||
        name.includes("Support mensuel") ||
        name.includes("Revue mensuelle") ||
        i % 9 === 0);

    const isStockable = type === ItemType.PRODUCT && i % 4 !== 0 && i < 36;

    const category = categories[i % categories.length];

    const itemData = mapMoneyFieldsToDb(
      {
        organizationId,
        itemNumber: `ART-${String(i + 1).padStart(4, "0")}`,
        sku: `SKU-NG-${String(i + 1).padStart(4, "0")}`,
        type,
        status,
        name,
        shortDescription: `${type === ItemType.SERVICE ? "Prestation" : "Produit"} exemple — ${name}`,
        description: `Description fictive pour ${name}. Données de démonstration Joey & Joey.`,
        categoryId: category.id,
        unitId: units[type === ItemType.SERVICE ? (i % 3 === 0 ? 1 : i % 3 === 1 ? 4 : 0) : 5].id,
        imageUrl: `/demo/item-placeholder.svg`,
        barcode: `3700000${String(100000 + i)}`,
        defaultVatRate: vatRate,
        salePriceExcludingTax: saleHT,
        salePriceIncludingTax: pricing.salePriceIncludingTax,
        purchasePriceExcludingTax: purchaseHT,
        marginAmount: pricing.marginAmount,
        marginRate: pricing.marginRate,
        currency: "EUR",
        isRecurring,
        recurringInterval: isRecurring
          ? ([RecurringInterval.MONTHLY, RecurringInterval.QUARTERLY, RecurringInterval.YEARLY][
              i % 3
            ] as RecurringInterval)
          : null,
        isStockable,
        stockQuantity: isStockable ? 10 + i * 2 : 0,
        stockAlertThreshold: isStockable ? 5 : 0,
        notes: i % 4 === 0 ? "Article interne " : null,
        isArchived,
        archivedAt: isArchived ? new Date("2025-10-01") : null,
        createdAt: new Date(Date.now() - (40 - i) * 5 * 24 * 60 * 60 * 1000),
      },
      [...ITEM_MONEY_FIELDS],
    );

    const item = await prisma.item.create({ data: itemData });

    items.push(item);

    const assignedTagIds = new Set<string>();

    async function assignTag(tagId: string) {
      if (assignedTagIds.has(tagId)) return;
      assignedTagIds.add(tagId);
      await prisma.itemTagAssignment.create({
        data: { organizationId, itemId: item.id, tagId },
      });
    }

    await assignTag(tags[i % tags.length].id);

    if (pricing.marginRate > 50) {
      await assignTag(tags.find((t) => t.name === "Forte marge")!.id);
    }
    if (pricing.marginRate < 15 && pricing.marginRate >= 0) {
      await assignTag(tags.find((t) => t.name === "Faible marge")!.id);
    }
    if (isRecurring) {
      await assignTag(tags.find((t) => t.name === "Récurrent")!.id);
    }
  }

  let activityCount = 0;
  const activityTypes: ItemActivityType[] = [
    "CREATED",
    "UPDATED",
    "PRICE_UPDATED",
    "ADDED_TO_QUOTE",
    "ADDED_TO_INVOICE",
    "NOTE",
  ];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const count = 1 + (idx % 2);
    for (let a = 0; a < count; a++) {
      const type = activityTypes[(idx + a) % activityTypes.length];
      const activityDate = new Date();
      activityDate.setDate(activityDate.getDate() - (a + 1) * 5);

      await prisma.itemActivity.create({
        data: {
          organizationId,
          itemId: item.id,
          type,
          title:
            type === "ADDED_TO_QUOTE"
              ? `Devis DEV-2026-${String(100 + idx).slice(-4)} — ${item.name}`
              : type === "ADDED_TO_INVOICE"
                ? `Facture FAC-2026-${String(200 + idx).slice(-4)} — ${item.name}`
                : `${type} — ${item.name}`,
          description: "Activité fictive ",
          amount: toDbDecimal(item.salePriceExcludingTax),
          quantity: toDbDecimal(a + 1),
          activityDate,
        },
      });
      activityCount++;
    }
  }

  let priceHistoryCount = 0;
  for (let i = 0; i < 20; i++) {
    const item = items[i];
    const oldSale = moneyToNumber(moneyMul(item.salePriceExcludingTax, 0.9));
    await prisma.itemPriceHistory.create({
      data: {
        organizationId,
        itemId: item.id,
        oldSalePriceExcludingTax: toDbDecimal(oldSale),
        newSalePriceExcludingTax: toDbDecimal(item.salePriceExcludingTax),
        oldPurchasePriceExcludingTax: toDbDecimal(
          moneyMul(item.purchasePriceExcludingTax, 0.95),
        ),
        newPurchasePriceExcludingTax: toDbDecimal(item.purchasePriceExcludingTax),
        oldVatRate: toDbDecimal(item.defaultVatRate),
        newVatRate: toDbDecimal(item.defaultVatRate),
        changedById: ownerUserId,
        changedAt: new Date(Date.now() - (20 - i) * 10 * 24 * 60 * 60 * 1000),
      },
    });
    priceHistoryCount++;
  }

  await prisma.numberingSequence.updateMany({
    where: { organizationId, type: "ITEM" },
    data: { nextNumber: 41 },
  });

  console.log(
    `   ✓ ${items.length} articles, ${activityCount} activités, ${priceHistoryCount} historiques prix`,
  );
}
