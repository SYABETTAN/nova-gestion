import { describe, expect, it } from "vitest";
import { getPermissionsForRole, hasPermission } from "@/lib/permissions";

function userWithRole(roleKey: "OWNER" | "ADMIN" | "ACCOUNTANT" | "SALES" | "READ_ONLY") {
  return {
    id: "u1",
    email: "test@demo.local",
    name: "Test",
    organizationId: "org1",
    roleKey,
    permissions: getPermissionsForRole(roleKey),
  };
}

describe("customer permissions", () => {
  it("READ_ONLY ne peut pas créer", () => {
    const user = userWithRole("READ_ONLY");
    expect(hasPermission(user, "CUSTOMERS_READ")).toBe(true);
    expect(hasPermission(user, "CUSTOMERS_CREATE")).toBe(false);
  });

  it("SALES peut créer", () => {
    const user = userWithRole("SALES");
    expect(hasPermission(user, "CUSTOMERS_CREATE")).toBe(true);
    expect(hasPermission(user, "CUSTOMERS_UPDATE")).toBe(true);
    expect(hasPermission(user, "CUSTOMERS_DELETE")).toBe(false);
  });

  it("ACCOUNTANT peut lire", () => {
    const user = userWithRole("ACCOUNTANT");
    expect(hasPermission(user, "CUSTOMERS_READ")).toBe(true);
    expect(hasPermission(user, "CUSTOMERS_CREATE")).toBe(false);
  });

  it("OWNER peut archiver", () => {
    const user = userWithRole("OWNER");
    expect(hasPermission(user, "CUSTOMERS_DELETE")).toBe(true);
  });
});
