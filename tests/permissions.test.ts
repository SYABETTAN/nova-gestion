import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  getPermissionsForRole,
  hasPermission,
  requirePermission,
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

describe("permissions", () => {
  it("OWNER possède toutes les permissions", () => {
    const user = mockUser("OWNER");
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission(user, permission)).toBe(true);
    }
  });

  it("ADMIN possède toutes les permissions", () => {
    const user = mockUser("ADMIN");
    for (const permission of ALL_PERMISSIONS) {
      expect(hasPermission(user, permission)).toBe(true);
    }
  });

  it("READ_ONLY ne peut pas modifier les paramètres", () => {
    const user = mockUser("READ_ONLY");
    expect(hasPermission(user, "SETTINGS_READ")).toBe(true);
    expect(hasPermission(user, "SETTINGS_UPDATE")).toBe(false);
    expect(() => requirePermission(user, "SETTINGS_UPDATE")).toThrow();
  });

  it("SALES ne peut pas modifier la numérotation", () => {
    const user = mockUser("SALES");
    expect(hasPermission(user, "NUMBERING_READ")).toBe(false);
    expect(hasPermission(user, "NUMBERING_UPDATE")).toBe(false);
  });

  it("ACCOUNTANT peut lire le journal d'audit", () => {
    const user = mockUser("ACCOUNTANT");
    expect(hasPermission(user, "AUDIT_LOG_READ")).toBe(true);
  });
});
