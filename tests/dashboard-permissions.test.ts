import { describe, expect, it } from "vitest";
import {
  getPermissionsForRole,
  hasPermission,
  type SessionUser,
} from "@/lib/permissions";

function mockUser(roleKey: SessionUser["roleKey"]): SessionUser {
  return {
    id: "user-1",
    email: "test@demo.local",
    name: "Test",
    organizationId: "org-1",
    roleKey,
    permissions: getPermissionsForRole(roleKey),
  };
}

describe("dashboard permissions", () => {
  it("READ_ONLY peut lire le dashboard", () => {
    const user = mockUser("READ_ONLY");
    expect(hasPermission(user, "DASHBOARD_READ")).toBe(true);
  });

  it("READ_ONLY ne peut pas exporter", () => {
    const user = mockUser("READ_ONLY");
    expect(hasPermission(user, "DASHBOARD_EXPORT")).toBe(false);
  });

  it("ACCOUNTANT peut voir et exporter le dashboard", () => {
    const user = mockUser("ACCOUNTANT");
    expect(hasPermission(user, "DASHBOARD_READ")).toBe(true);
    expect(hasPermission(user, "DASHBOARD_EXPORT")).toBe(true);
    expect(hasPermission(user, "ACCOUNTING_READ")).toBe(true);
  });

  it("SALES peut voir le dashboard", () => {
    const user = mockUser("SALES");
    expect(hasPermission(user, "DASHBOARD_READ")).toBe(true);
    expect(hasPermission(user, "CUSTOMERS_READ")).toBe(true);
  });

  it("OWNER peut tout faire", () => {
    const user = mockUser("OWNER");
    expect(hasPermission(user, "DASHBOARD_READ")).toBe(true);
    expect(hasPermission(user, "DASHBOARD_EXPORT")).toBe(true);
  });
});
