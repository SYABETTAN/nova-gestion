import type {
  EstherCustomerSeed,
  EstherDocumentSeed,
  EstherProductSeed,
  EstherSupplierInvoiceSeed,
  EstherSupplierSeed,
} from "@/lib/esther-real-data/types";

/** Clients réels Esther — source : attestations RNE / INPI (juin 2026). */
export const ESTHER_REAL_CUSTOMERS: EstherCustomerSeed[] = [
  {
    importKey: "customer-talidress-levalois",
    name: "TALIDRESS LEVALLOIS",
    legalName: "TALIDRESS LEVALLOIS",
    siren: "930535372",
    siret: "93053537200013",
    legalForm: "SASU",
    industry: "4771Z — Commerce de détail d'habillement en magasin spécialisé",
    notes:
      "Import RNE du 14/06/2026. Établissement secondaire SIRET 93053537200021 — 4 Rue Camille Pelletan, 92300 Levallois-Perret. Capital 1 000 €. Président : GAMRASNI OVADIA.",
    sourceDocument: "kbis-talidress-levalois.pdf",
    metadata: {
      siren: "930535372",
      siretSecondary: "93053537200021",
      president: "GAMRASNI OVADIA",
      capital: "1000 EUR",
      ape: "4771Z",
    },
    addresses: [
      {
        type: "HEADQUARTERS",
        label: "Siège social",
        addressLine1: "31 Rue Camille Mouquet",
        postalCode: "94220",
        city: "Charenton-le-Pont",
        country: "FR",
        isDefault: true,
      },
      {
        type: "OTHER",
        label: "Établissement Levallois-Perret",
        addressLine1: "4 Rue Camille Pelletan",
        postalCode: "92300",
        city: "Levallois-Perret",
        country: "FR",
      },
    ],
    contacts: [
      {
        firstName: "OVADIA",
        lastName: "GAMRASNI",
        jobTitle: "Président de SAS",
        isPrimary: true,
      },
    ],
  },
  {
    importKey: "customer-zacko-romy",
    name: "ZACKO",
    legalName: "ZACKO",
    displayName: "Romy",
    siren: "829014232",
    siret: "82901423200021",
    legalForm: "SASU",
    industry: "4771Z / 4791B — Vente à distance prêt-à-porter",
    notes:
      "Import RNE du 14/06/2026. Nom commercial Romy. Dirigeant : Michel Salomon Boutboul. Ancien établissement fermé : 103 Rue du Faubourg du Temple, 75010 Paris (SIRET 82901423200013).",
    sourceDocument: "kbis-zacko-romy.pdf",
    metadata: {
      siren: "829014232",
      commercialName: "Romy",
      president: "Michel Salomon Boutboul",
      capital: "1000 EUR",
      ape: "4771Z",
      apeSecondary: "4791B",
    },
    addresses: [
      {
        type: "HEADQUARTERS",
        label: "Siège social",
        addressLine1: "29 Avenue du Maréchal Juin",
        postalCode: "93260",
        city: "Les Lilas",
        country: "FR",
        isDefault: true,
      },
    ],
    contacts: [
      {
        firstName: "Michel Salomon",
        lastName: "Boutboul",
        jobTitle: "Président de SAS",
        isPrimary: true,
      },
    ],
  },
  {
    importKey: "customer-simha-emoi",
    name: "SAS SIMHA EMOI",
    legalName: "SAS SIMHA EMOI",
    phone: "0611392216",
    notes:
      "Identifié sur facture fournisseur MSI FA37374 (code client fournisseur 6520). SIREN/SIRET non présents sur le PDF — à compléter si disponible.",
    sourceDocument: "facture-msi-fa37374.pdf",
    metadata: {
      supplierCustomerCode: "6520",
    },
    addresses: [
      {
        type: "BILLING",
        label: "Adresse facturation",
        addressLine1: "70 Avenue Victor Hugo",
        addressLine2: "Lot 85",
        postalCode: "93300",
        city: "Aubervilliers",
        country: "FR",
        isDefault: true,
      },
    ],
  },
];

/** Fournisseurs réels — source : factures / documents comptables. */
export const ESTHER_REAL_SUPPLIERS: EstherSupplierSeed[] = [
  {
    importKey: "supplier-msi",
    name: "SAS M.S.I",
    legalName: "SAS M.S.I",
    vatNumber: "FR43533963153",
    email: "msi2626@hotmail.fr",
    phone: "0144021682",
    notes:
      "Capital 6 000 €. RCS 533 963 153. Tél Paris 11e : 01 43 38 51 94. Tél Aubervilliers : 01 44 02 16 82.",
    sourceDocument: "facture-msi-fa37374.pdf",
    metadata: {
      rcs: "533963153",
      capital: "6000 EUR",
      phoneParis: "0143385194",
      phoneAubervilliers: "0144021682",
    },
    addresses: [
      {
        type: "HEADQUARTERS",
        label: "Siège",
        addressLine1: "5 Rue Saint-Gobain",
        addressLine2: "Lot 3029 CIFA3",
        postalCode: "93300",
        city: "Aubervilliers",
        country: "FR",
        isDefault: true,
      },
    ],
    bankAccount: {
      label: "Compte principal",
      iban: "FR7610107001750062105399596",
      bic: "BREDFRPPXXX",
      accountHolder: "SAS M.S.I",
    },
  },
  {
    importKey: "supplier-avitex",
    name: "AVITEX",
    notes:
      "Fournisseur identifié sur facture FA20260053 (10/06/2026). PDF non fourni — fiche créée en attente de document source.",
    metadata: {
      pendingInvoice: "FA20260053",
    },
    addresses: [],
  },
];

/** Références connues hors facture MSI (sans prix d'achht sur document). */
export const ESTHER_EXTRA_PRODUCTS: EstherProductSeed[] = [
  {
    sku: "JPE26",
    name: "JUPE VAVA",
    description: "Référence mentionnée dans le lot d'import Esther — prix d'achat non documenté.",
    supplierImportKey: "supplier-msi",
    sourceDocument: "manual-import",
    notes: "Prix d'achat à compléter.",
  },
  {
    sku: "GSR26",
    name: "ROBE GOLD AND SILVER",
    description: "Référence mentionnée dans le lot d'import Esther — prix d'achat non documenté.",
    supplierImportKey: "supplier-msi",
    sourceDocument: "manual-import",
    notes: "Prix d'achat à compléter.",
  },
  {
    sku: "VENEZIA-2",
    name: "VENEZIA 2",
    description: "Produit visible sur facture AVITEX FA20260053 — détails à compléter.",
    supplierImportKey: "supplier-avitex",
    sourceDocument: "avitex-fa20260053-pending",
    notes: "Facture AVITEX PDF non fournie.",
  },
  {
    sku: "BUBBLE-SATIN",
    name: "BUBBLE SATIN",
    description: "Produit visible sur facture AVITEX FA20260053 — détails à compléter.",
    supplierImportKey: "supplier-avitex",
    sourceDocument: "avitex-fa20260053-pending",
    notes: "Facture AVITEX PDF non fournie.",
  },
];

/** Lignes facture MSI FA37374 — source PDF du 26/08/2025. */
export const MSI_INVOICE_FA37374_LINES = [
  { reference: "L25RINA", name: "COMBIPANTALONS TWILL", description: "100% COTON TWILL", quantity: 35, unitPriceExcludingTax: 26.5 },
  { reference: "L25SHINE", name: "ENSEMBLE TOP + SHORT", description: "100% COTON", quantity: 48, unitPriceExcludingTax: 23.5 },
  { reference: "L25VANILLA", name: "ENSEMBLE TOP + SHORT", description: "100% VISCOSE SLUB", quantity: 42, unitPriceExcludingTax: 28.5 },
  { reference: "L25NIBY", name: "EMSEMBLE IKAT", description: "100% COTON", quantity: 54, unitPriceExcludingTax: 29.5 },
  { reference: "L25NIN", name: "EMSEMBLE IKAT", description: "100% COTON", quantity: 4, unitPriceExcludingTax: 33.5 },
  { reference: "L25LUMIERE", name: "ENSEMBLE PRINT TOP + PANTALONS", description: "100% VISCOSE", quantity: 12, unitPriceExcludingTax: 26.5 },
  { reference: "L25SHINE", name: "ENSEMBLE TOP + SHORT", description: "100% COTON", quantity: 21, unitPriceExcludingTax: 23.5 },
  { reference: "L25SHINE", name: "ENSEMBLE TOP + SHORT", description: "100% COTON", quantity: 6, unitPriceExcludingTax: 23.5 },
  { reference: "L25MARVI", name: "ENSEMBLE SEQUINS TOP+SHORT", description: "100% SATIN VISCOSE", quantity: 36, unitPriceExcludingTax: 24.5 },
  { reference: "L26SAVANNA", name: "ENSEMBLE TOP + PANTS", description: "100% COTON", quantity: 43, unitPriceExcludingTax: 29.5 },
  { reference: "25BONNI", name: "VESTE", description: "100% COTON", quantity: 65, unitPriceExcludingTax: 33.5 },
  { reference: "L25APACHE", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 90, unitPriceExcludingTax: 13.5 },
  { reference: "L25MANDA", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 105, unitPriceExcludingTax: 13.5 },
  { reference: "L25SMILE", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 135, unitPriceExcludingTax: 13.5 },
  { reference: "L25TRUST", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 6, unitPriceExcludingTax: 12.5 },
  { reference: "L25SINGY", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 72, unitPriceExcludingTax: 13.5 },
  { reference: "L25LUCKY", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 72, unitPriceExcludingTax: 13.0 },
  { reference: "L25TROPIC", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 54, unitPriceExcludingTax: 13.0 },
  { reference: "L25SUNSHINE", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 66, unitPriceExcludingTax: 13.5 },
  { reference: "L25SWEET", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 78, unitPriceExcludingTax: 13.0 },
  { reference: "L25PALM", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 36, unitPriceExcludingTax: 13.5 },
  { reference: "L25LOTUS", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 66, unitPriceExcludingTax: 12.5 },
  { reference: "L25EYETR", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 48, unitPriceExcludingTax: 13.5 },
  { reference: "L25SUMMER", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 36, unitPriceExcludingTax: 13.5 },
  { reference: "L25MAGIC", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 78, unitPriceExcludingTax: 13.5 },
  { reference: "L25JOY", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 78, unitPriceExcludingTax: 13.0 },
  { reference: "L25TIGER", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 54, unitPriceExcludingTax: 12.5 },
  { reference: "L25LAVIDA", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 54, unitPriceExcludingTax: 13.5 },
  { reference: "L25NATURE", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 18, unitPriceExcludingTax: 13.5 },
  { reference: "L25APACHE", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 74, unitPriceExcludingTax: 13.5 },
  { reference: "L25NATURE", name: "TEE SHIRT STONEWASH", description: "100% COTON STONEWASH", quantity: 18, unitPriceExcludingTax: 13.5 },
  { reference: "L25STAN", name: "PANTALONS", description: "70% VISCOSE 20% LIN", quantity: 72, unitPriceExcludingTax: 17.5 },
  { reference: "L24MONO", name: "PANTALONS", description: "100% VISCOSE SATIN", quantity: 11, unitPriceExcludingTax: 17.5 },
  { reference: "L25SCOTT", name: "PANTALONS", description: "70% VISCOSE 30% LIN", quantity: 22, unitPriceExcludingTax: 19.5 },
  { reference: "L25LUTEC", name: "ROBES PATCH", description: "100% VISCOSE", quantity: 156, unitPriceExcludingTax: 19.5 },
  { reference: "L25BAMBI", name: "ROBES", description: "100% VISCOSE DE CREPES", quantity: 75, unitPriceExcludingTax: 23.5 },
  { reference: "L18ROBESO", name: "ROBES SOLDE", description: "Soldes", quantity: 1513, unitPriceExcludingTax: 7.0 },
  { reference: "L24TOP", name: "TOPS SOLDE", description: "Soldes", quantity: 927, unitPriceExcludingTax: 6.0 },
  { reference: "H18PULSO", name: "PULLS SOLDE", description: "Soldes", quantity: 392, unitPriceExcludingTax: 11.0 },
  { reference: "L25VALE", name: "SHORT", description: "100% COTON", quantity: 65, unitPriceExcludingTax: 19.5 },
  { reference: "L25MAYAP", name: "KIMONO PATCHWORK", description: "100% VISCOSE", quantity: 30, unitPriceExcludingTax: 17.5 },
] as const;

/** Catalogue produits dérivé de la facture MSI (prix = 1ère occurrence par référence). */
export function buildMsiProductCatalog(): EstherProductSeed[] {
  const bySku = new Map<string, EstherProductSeed>();

  for (const line of MSI_INVOICE_FA37374_LINES) {
    if (bySku.has(line.reference)) continue;
    bySku.set(line.reference, {
      sku: line.reference,
      name: line.name,
      description: line.description,
      shortDescription: line.description,
      purchasePriceExcludingTax: line.unitPriceExcludingTax,
      defaultVatRate: 20,
      supplierImportKey: "supplier-msi",
      sourceDocument: "facture-msi-fa37374.pdf",
      composition: line.description,
    });
  }

  return [...bySku.values()];
}

export const ESTHER_REAL_PRODUCTS: EstherProductSeed[] = [
  ...buildMsiProductCatalog(),
  ...ESTHER_EXTRA_PRODUCTS,
];

export const ESTHER_REAL_SUPPLIER_INVOICES: EstherSupplierInvoiceSeed[] = [
  {
    importKey: "supplier-invoice-msi-fa37374",
    supplierImportKey: "supplier-msi",
    supplierReference: "FA37374",
    title: "Facture MSI FA37374",
    issueDate: "2025-08-26",
    receivedDate: "2025-08-26",
    dueDate: "2025-08-26",
    currency: "EUR",
    defaultVatRate: 20,
    subtotalExcludingTax: 55649.5,
    totalDiscountAmount: 12799.38,
    totalExcludingTax: 42850.12,
    totalVatAmount: 8570.02,
    totalIncludingTax: 51420.14,
    amountDue: 3420.14,
    amountPaid: 48000,
    internalNotes:
      "Import PDF facture MSI FA37374 du 26/08/2025. Client facturé côté MSI : SAS SIMHA EMOI (code 6520). Remise globale 12 799,38 € HT appliquée sur facture.",
    sourcePdf: "facture-msi-fa37374.pdf",
    lines: MSI_INVOICE_FA37374_LINES.map((line) => ({
      reference: line.reference,
      name: line.name,
      description: line.description,
      quantity: line.quantity,
      unitPriceExcludingTax: line.unitPriceExcludingTax,
      vatRate: 20,
      unit: "pièce",
    })),
  },
  {
    importKey: "supplier-invoice-avitex-fa20260053",
    supplierImportKey: "supplier-avitex",
    supplierReference: "FA20260053",
    title: "Facture AVITEX FA20260053",
    issueDate: "2026-06-10",
    receivedDate: "2026-06-10",
    dueDate: "2026-07-10",
    currency: "EUR",
    defaultVatRate: 20,
    totalExcludingTax: 4557.8,
    totalVatAmount: 911.56,
    totalIncludingTax: 5469.36,
    internalNotes:
      "Métadonnées extraites du cahier des charges — PDF AVITEX non fourni. Client mentionné : JOEY AND JOE / SAS SIMHA EMOI.",
    pendingPdf: true,
    lines: [
      { reference: "VENEZIA-2", name: "VENEZIA 2", quantity: 1, unitPriceExcludingTax: 0, vatRate: 20, unit: "pièce" },
      { reference: "BUBBLE-SATIN", name: "BUBBLE SATIN", quantity: 1, unitPriceExcludingTax: 0, vatRate: 20, unit: "pièce" },
    ],
  },
];

export const ESTHER_REAL_DOCUMENTS: EstherDocumentSeed[] = [
  {
    importKey: "doc-kbis-talidress",
    fileName: "kbis-talidress-levalois.pdf",
    relativePdfPath: "pdfs/kbis-talidress-levalois.pdf",
    title: "Attestation RNE — TALIDRESS LEVALLOIS",
    description: "Export Portail Data INPI du 14/06/2026",
    type: "OTHER",
    entityType: "Customer",
    entityImportKey: "customer-talidress-levalois",
  },
  {
    importKey: "doc-kbis-zacko",
    fileName: "kbis-zacko-romy.pdf",
    relativePdfPath: "pdfs/kbis-zacko-romy.pdf",
    title: "Attestation RNE — ZACKO (Romy)",
    description: "Kbis / attestation RNE du 14/06/2026",
    type: "OTHER",
    entityType: "Customer",
    entityImportKey: "customer-zacko-romy",
  },
  {
    importKey: "doc-facture-msi",
    fileName: "facture-msi-fa37374.pdf",
    relativePdfPath: "pdfs/facture-msi-fa37374.pdf",
    title: "Facture MSI FA37374",
    description: "Facture fournisseur SAS M.S.I — 26/08/2025",
    type: "SUPPLIER_ATTACHMENT",
    entityType: "SupplierInvoice",
    entityImportKey: "supplier-invoice-msi-fa37374",
  },
  {
    importKey: "doc-facture-msi-supplier",
    fileName: "facture-msi-fa37374.pdf",
    relativePdfPath: "pdfs/facture-msi-fa37374.pdf",
    title: "Facture MSI FA37374 (fournisseur)",
    description: "Copie documentaire rattachée au fournisseur SAS M.S.I",
    type: "OTHER",
    entityType: "Supplier",
    entityImportKey: "supplier-msi",
  },
];
