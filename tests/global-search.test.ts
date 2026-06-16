import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  globalSearch,
  loadEnabledModules,
  loadFavoriteKeys,
  searchByType,
  searchCustomers,
} from "@/lib/search/search-service";
import { getPermissionsForRole } from "@/lib/permissions";
import { SearchEntityType } from "@prisma/client";

const prisma = new PrismaClient();
const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("global search integration", () => {
  it("trouve SAS SIMHA EMOI par nom", async () => {
    const customer = await prisma.customer.findFirst({
      where: { name: { contains: "SIMHA", mode: "insensitive" } },
    });
    expect(customer).toBeTruthy();

    const rows = await searchCustomers(customer!.organizationId, "SAS SIMHA EMOI", 10);
    expect(rows.some((r) => r.title.includes("SIMHA"))).toBe(true);
  });

  it("globalSearch ne throw pas pour une recherche client", async () => {
    const customer = await prisma.customer.findFirst({
      where: { name: { contains: "SIMHA", mode: "insensitive" } },
    });
    const owner = await prisma.organizationMember.findFirst({
      where: { organizationId: customer!.organizationId, status: "ACTIVE" },
      include: { user: true, role: true },
    });

    expect(owner).toBeTruthy();

    const user = {
      id: owner!.user.id,
      email: owner!.user.email,
      name: owner!.user.name,
      organizationId: customer!.organizationId,
      roleKey: owner!.role.key,
      permissions: getPermissionsForRole(owner!.role.key),
    };

    const enabledModules = await loadEnabledModules(customer!.organizationId);
    const favoriteKeys = await loadFavoriteKeys(customer!.organizationId, owner!.user.id);

    const result = await globalSearch(user, "SAS SIMHA EMOI", {
      organizationId: customer!.organizationId,
      enabledModules,
      favoriteKeys,
    });

    const customers = result.groups.find((g) => g.type === "CUSTOMER")?.results ?? [];
    expect(customers.length).toBeGreaterThan(0);
  });

  it("globalSearch filtre par type CUSTOMER", async () => {
    const customer = await prisma.customer.findFirst({
      where: { name: { contains: "SIMHA", mode: "insensitive" } },
    });
    const owner = await prisma.organizationMember.findFirst({
      where: { organizationId: customer!.organizationId, status: "ACTIVE" },
      include: { user: true, role: true },
    });
    const user = {
      id: owner!.user.id,
      email: owner!.user.email,
      name: owner!.user.name,
      organizationId: customer!.organizationId,
      roleKey: owner!.role.key,
      permissions: getPermissionsForRole(owner!.role.key),
    };
    const result = await globalSearch(user, "SAS SIMHA EMOI", {
      organizationId: customer!.organizationId,
      enabledModules: await loadEnabledModules(customer!.organizationId),
      favoriteKeys: await loadFavoriteKeys(customer!.organizationId, owner!.user.id),
      types: ["CUSTOMER"],
    });
    expect(result.groups.every((g) => g.type === "CUSTOMER" || g.type === "ACTION")).toBe(true);
    expect(result.groups.some((g) => g.type === "CUSTOMER" && g.results.length > 0)).toBe(true);
  });

  it("searchByType CUSTOMER avec type invalide retourne []", async () => {
    const customer = await prisma.customer.findFirst();
    expect(customer).toBeTruthy();
    const rows = await searchByType(
      "INVALID" as SearchEntityType,
      customer!.organizationId,
      "test",
      5,
    );
    expect(rows).toEqual([]);
  });

  it("globalSearch avec query vide ne throw pas", async () => {
    const customer = await prisma.customer.findFirst();
    const owner = await prisma.organizationMember.findFirst({
      where: { organizationId: customer!.organizationId, status: "ACTIVE" },
      include: { user: true, role: true },
    });
    expect(owner).toBeTruthy();

    const user = {
      id: owner!.user.id,
      email: owner!.user.email,
      name: owner!.user.name,
      organizationId: customer!.organizationId,
      roleKey: owner!.role.key,
      permissions: getPermissionsForRole(owner!.role.key),
    };
    const result = await globalSearch(user, "", {
      organizationId: customer!.organizationId,
      enabledModules: await loadEnabledModules(customer!.organizationId),
      favoriteKeys: await loadFavoriteKeys(customer!.organizationId, owner!.user.id),
    });
    expect(result.query).toBe("");
  });
});
