import { describe, expect, it } from "vitest";
import {
  getPermissionsForRole,
  hasPermission,
  type SessionUser,
} from "@/lib/permissions";
import { canSearchEntityType } from "@/lib/search/search-permissions";

function mockUser(roleKey: SessionUser["roleKey"]): SessionUser {
  return {
    id: "u1",
    email: "t@demo.local",
    name: "Test",
    organizationId: "org1",
    roleKey,
    permissions: getPermissionsForRole(roleKey),
  };
}

const allModules = new Set([
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
  "advancedSettings",
  "dashboard",
]);

describe("search permissions", () => {
  it("ne retourne pas clients sans CUSTOMERS_READ", () => {
    const user = { ...mockUser("READ_ONLY"), permissions: [] as never };
    expect(canSearchEntityType(user, "CUSTOMER", allModules)).toBe(false);
  });

  it("SALES peut rechercher clients", () => {
    expect(canSearchEntityType(mockUser("SALES"), "CUSTOMER", allModules)).toBe(true);
  });

  it("READ_ONLY ne peut pas comptabilité sans permission", () => {
    const user = mockUser("READ_ONLY");
    expect(hasPermission(user, "ACCOUNTING_READ")).toBe(true);
    expect(canSearchEntityType(user, "ACCOUNTING_ENTRY", allModules)).toBe(true);
  });

  it("masque module si feature flag désactivé", () => {
    const user = mockUser("OWNER");
    const disabled = new Set(allModules);
    disabled.delete("quotes");
    expect(canSearchEntityType(user, "QUOTE", disabled)).toBe(false);
  });
});
