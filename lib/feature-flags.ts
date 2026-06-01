import { prisma } from "@/lib/prisma";

export const FEATURE_FLAG_DEFINITIONS: { key: string; name: string; description: string; isSystem?: boolean }[] = [
  { key: "customers", name: "Clients", description: "Gestion de la clientèle", isSystem: true },
  { key: "items", name: "Articles & services", description: "Catalogue produits", isSystem: true },
  { key: "quotes", name: "Devis", description: "Propositions commerciales", isSystem: true },
  { key: "invoices", name: "Factures", description: "Facturation clients", isSystem: true },
  { key: "payments", name: "Paiements", description: "Encaissements clients", isSystem: true },
  { key: "reminders", name: "Relances", description: "Recouvrement", isSystem: true },
  { key: "suppliers", name: "Fournisseurs", description: "Gestion fournisseurs", isSystem: true },
  { key: "supplierInvoices", name: "Factures fournisseurs", description: "Dépenses", isSystem: true },
  { key: "accounting", name: "Comptabilité légère", description: "Pré-comptabilité", isSystem: true },
  { key: "dashboard", name: "Tableau de bord", description: "Pilotage", isSystem: true },
  { key: "exports", name: "Exports", description: "Centre d'exports", isSystem: true },
  { key: "documents", name: "Documents", description: "Bibliothèque documentaire", isSystem: true },
  { key: "advancedSettings", name: "Paramètres avancés", description: "Configuration", isSystem: true },
];

const NAV_FLAG_MAP: Record<string, string> = {
  "/customers": "customers",
  "/items": "items",
  "/quotes": "quotes",
  "/invoices": "invoices",
  "/payments": "payments",
  "/reminders": "reminders",
  "/suppliers": "suppliers",
  "/supplier-invoices": "supplierInvoices",
  "/accounting": "accounting",
  "/dashboard": "dashboard",
  "/exports": "exports",
  "/documents": "documents",
};

export async function isFeatureEnabled(organizationId: string, key: string): Promise<boolean> {
  if (key === "advancedSettings") return true;
  const flag = await prisma.featureFlag.findUnique({
    where: { organizationId_key: { organizationId, key } },
  });
  return flag?.enabled ?? true;
}

export function getFeatureKeyForPath(pathname: string): string | null {
  for (const [prefix, key] of Object.entries(NAV_FLAG_MAP)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return key;
  }
  return null;
}

export function canDisableFeatureFlag(key: string): boolean {
  return key !== "advancedSettings";
}
