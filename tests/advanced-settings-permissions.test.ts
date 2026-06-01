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

describe("advanced settings permissions", () => {
  it("READ_ONLY peut lire", () => {
    const user = mockUser("READ_ONLY");
    expect(hasPermission(user, "ADVANCED_SETTINGS_READ")).toBe(true);
  });

  it("READ_ONLY ne peut pas modifier", () => {
    const user = mockUser("READ_ONLY");
    expect(hasPermission(user, "ADVANCED_SETTINGS_UPDATE")).toBe(false);
  });

  it("ACCOUNTANT peut modifier comptabilité via paramètres avancés", () => {
    const user = mockUser("ACCOUNTANT");
    expect(hasPermission(user, "ADVANCED_SETTINGS_UPDATE")).toBe(true);
  });

  it("SALES peut lire commercial", () => {
    const user = mockUser("SALES");
    expect(hasPermission(user, "ADVANCED_SETTINGS_READ")).toBe(true);
  });

  it("OWNER peut tout faire", () => {
    const user = mockUser("OWNER");
    expect(hasPermission(user, "ADVANCED_SETTINGS_UPDATE")).toBe(true);
    expect(hasPermission(user, "GLOBAL_SEARCH_USE")).toBe(true);
  });
});
