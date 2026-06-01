import { describe, expect, it } from "vitest";
import { getQuickActions } from "@/lib/search/quick-actions";
import { getPermissionsForRole, type SessionUser } from "@/lib/permissions";

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

describe("quick actions", () => {
  it("retourne les actions autorisées pour OWNER", () => {
    const actions = getQuickActions(mockUser("OWNER"), allModules);
    expect(actions.length).toBeGreaterThan(5);
    expect(actions.some((a) => a.id === "nav-customers")).toBe(true);
  });

  it("masque création client si permission absente", () => {
    const user = { ...mockUser("READ_ONLY"), permissions: getPermissionsForRole("READ_ONLY") };
    const actions = getQuickActions(user, allModules);
    expect(actions.some((a) => a.id === "new-customer")).toBe(false);
  });

  it("masque modules désactivés", () => {
    const modules = new Set(allModules);
    modules.delete("quotes");
    const actions = getQuickActions(mockUser("OWNER"), modules);
    expect(actions.some((a) => a.href === "/quotes")).toBe(false);
  });
});
