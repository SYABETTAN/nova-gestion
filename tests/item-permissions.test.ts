import { describe, expect, it } from "vitest";
import { getPermissionsForRole, hasPermission } from "@/lib/permissions";

function userWithRole(role: "OWNER" | "ADMIN" | "ACCOUNTANT" | "SALES" | "READ_ONLY") {
  return {
    id: "u1",
    email: "t@demo.local",
    name: "T",
    organizationId: "o1",
    roleKey: role,
    permissions: getPermissionsForRole(role),
  };
}

describe("item permissions", () => {
  it("READ_ONLY ne peut pas créer", () => {
    const u = userWithRole("READ_ONLY");
    expect(hasPermission(u, "ITEMS_READ")).toBe(true);
    expect(hasPermission(u, "ITEMS_CREATE")).toBe(false);
  });

  it("SALES peut créer", () => {
    const u = userWithRole("SALES");
    expect(hasPermission(u, "ITEMS_CREATE")).toBe(true);
    expect(hasPermission(u, "ITEMS_UPDATE")).toBe(true);
    expect(hasPermission(u, "ITEMS_DELETE")).toBe(false);
  });

  it("ACCOUNTANT peut lire", () => {
    const u = userWithRole("ACCOUNTANT");
    expect(hasPermission(u, "ITEMS_READ")).toBe(true);
    expect(hasPermission(u, "ITEMS_CREATE")).toBe(false);
  });

  it("OWNER peut archiver", () => {
    expect(hasPermission(userWithRole("OWNER"), "ITEMS_DELETE")).toBe(true);
  });
});
