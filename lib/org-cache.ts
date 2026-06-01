import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

async function loadEnabledModulesUncached(organizationId: string): Promise<Set<string>> {
  const flags = await prisma.featureFlag.findMany({
    where: { organizationId },
    select: { key: true, enabled: true },
  });
  const enabled = new Set<string>(["advancedSettings", "dashboard"]);
  for (const f of flags) {
    if (f.enabled) enabled.add(f.key);
  }
  if (flags.length === 0) {
    [
      "customers",
      "items",
      "quotes",
      "invoices",
      "payments",
      "reminders",
      "suppliers",
      "supplierInvoices",
      "accounting",
      "exports",
      "documents",
    ].forEach((k) => enabled.add(k));
  }
  return enabled;
}

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

/** Feature flags par organisation — cache 5 min, clé tenant-scoped. */
export function getCachedEnabledModules(organizationId: string) {
  if (isTestRuntime()) {
    return loadEnabledModulesUncached(organizationId);
  }
  return unstable_cache(
    () => loadEnabledModulesUncached(organizationId),
    ["org-modules", organizationId],
    { revalidate: 300, tags: [`org-${organizationId}-modules`] },
  )();
}

/** Taux TVA actifs — cache 10 min par organisation. */
export function getCachedTaxRates(organizationId: string) {
  if (isTestRuntime()) {
    return prisma.taxRate.findMany({
      where: { organizationId, isActive: true },
      orderBy: { rate: "asc" },
      select: { id: true, name: true, rate: true, isDefault: true },
    });
  }
  return unstable_cache(
    async () =>
      prisma.taxRate.findMany({
        where: { organizationId, isActive: true },
        orderBy: { rate: "asc" },
        select: { id: true, name: true, rate: true, isDefault: true },
      }),
    ["org-tax-rates", organizationId],
    { revalidate: 600, tags: [`org-${organizationId}-tax-rates`] },
  )();
}

/** Devises actives — cache 10 min par organisation. */
export function getCachedCurrencies(organizationId: string) {
  if (isTestRuntime()) {
    return prisma.currencySetting.findMany({
      where: { organizationId, isActive: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, symbol: true, isDefault: true },
    });
  }
  return unstable_cache(
    async () =>
      prisma.currencySetting.findMany({
        where: { organizationId, isActive: true },
        orderBy: { code: "asc" },
        select: { id: true, code: true, name: true, symbol: true, isDefault: true },
      }),
    ["org-currencies", organizationId],
    { revalidate: 600, tags: [`org-${organizationId}-currencies`] },
  )();
}
