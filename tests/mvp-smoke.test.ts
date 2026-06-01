import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DEMO_PASSWORD, DEMO_USERS, DEMO_ORGANIZATION } from "@/lib/demo-data";
import { getPermissionsForRole, hasPermission } from "@/lib/permissions";
import { verifyPassword } from "@/lib/auth";
import { globalSearch } from "@/lib/search/search-service";
import { loadEnabledModules, loadFavoriteKeys } from "@/lib/search/search-service";

const prisma = new PrismaClient();
const hasDevSeed = process.env.SEED_DEV_DATA === "true";

describe("MVP smoke — base de données et socle", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe.skipIf(!hasDevSeed)("fixtures de développement (SEED_DEV_DATA=true)", () => {
    it("organisation et utilisateurs de développement existent", async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: DEMO_ORGANIZATION.slug },
      });
      expect(org).toBeTruthy();

      for (const demo of DEMO_USERS) {
        const user = await prisma.user.findUnique({ where: { email: demo.email } });
        expect(user).toBeTruthy();
        const valid = await verifyPassword(DEMO_PASSWORD, user!.passwordHash);
        expect(valid).toBe(true);
      }
    });

    it("données commerciales seedées présentes", async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: DEMO_ORGANIZATION.slug },
      });
      expect(org).toBeTruthy();
      const orgId = org!.id;

      const [customers, items, quotes, invoices, payments, suppliers, entries] =
        await Promise.all([
          prisma.customer.count({ where: { organizationId: orgId } }),
          prisma.item.count({ where: { organizationId: orgId } }),
          prisma.quote.count({ where: { organizationId: orgId } }),
          prisma.invoice.count({ where: { organizationId: orgId } }),
          prisma.payment.count({ where: { organizationId: orgId } }),
          prisma.supplier.count({ where: { organizationId: orgId } }),
          prisma.accountingEntry.count({ where: { organizationId: orgId } }),
        ]);

      expect(customers).toBeGreaterThanOrEqual(20);
      expect(items).toBeGreaterThanOrEqual(30);
      expect(quotes).toBeGreaterThanOrEqual(30);
      expect(invoices).toBeGreaterThanOrEqual(30);
      expect(payments).toBeGreaterThanOrEqual(30);
      expect(suppliers).toBeGreaterThanOrEqual(20);
      expect(entries).toBeGreaterThanOrEqual(50);
    });

    it("paramètres avancés et recherche seedés", async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: DEMO_ORGANIZATION.slug },
      });
      const orgId = org!.id;

      const [taxRates, featureFlags, searchHistory] = await Promise.all([
        prisma.taxRate.count({ where: { organizationId: orgId } }),
        prisma.featureFlag.count({ where: { organizationId: orgId } }),
        prisma.searchHistory.count({ where: { organizationId: orgId } }),
      ]);

      expect(taxRates).toBeGreaterThanOrEqual(5);
      expect(featureFlags).toBeGreaterThanOrEqual(10);
      expect(searchHistory).toBeGreaterThanOrEqual(10);
    });

    it("recherche globale retourne des clients pour 'atelier'", async () => {
      const org = await prisma.organization.findUnique({
        where: { slug: DEMO_ORGANIZATION.slug },
      });
      const owner = await prisma.user.findUnique({
        where: { email: "owner@dev.local" },
      });
      expect(org && owner).toBeTruthy();

      const user = {
        id: owner!.id,
        email: owner!.email,
        name: owner!.name,
        organizationId: org!.id,
        roleKey: "OWNER" as const,
        permissions: getPermissionsForRole("OWNER"),
      };

      const enabledModules = await loadEnabledModules(org!.id);
      const favoriteKeys = await loadFavoriteKeys(org!.id, owner!.id);
      const result = await globalSearch(user, "atelier", {
        organizationId: org!.id,
        enabledModules,
        favoriteKeys,
      });

      const customerGroup = result.groups.find((g) => g.type === "CUSTOMER");
      expect(customerGroup?.results.length).toBeGreaterThan(0);
    });
  });

  it("rôles critiques ont les permissions attendues", () => {
    expect(hasPermission(
      { permissions: getPermissionsForRole("OWNER") },
      "GLOBAL_SEARCH_USE",
    )).toBe(true);
    expect(hasPermission(
      { permissions: getPermissionsForRole("READ_ONLY") },
      "CUSTOMERS_READ",
    )).toBe(true);
    expect(hasPermission(
      { permissions: getPermissionsForRole("READ_ONLY") },
      "CUSTOMERS_CREATE",
    )).toBe(false);
  });
});
