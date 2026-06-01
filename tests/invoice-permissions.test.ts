import { describe, expect, it } from "vitest";
import { getPermissionsForRole, hasPermission } from "@/lib/permissions";

function userWithRole(role: "OWNER" | "ADMIN" | "ACCOUNTANT" | "SALES" | "READ_ONLY") {
  return { permissions: getPermissionsForRole(role) };
}

describe("invoice permissions", () => {
  it("READ_ONLY ne peut pas créer", () => {
    expect(hasPermission(userWithRole("READ_ONLY"), "INVOICES_CREATE")).toBe(false);
  });
  it("SALES peut créer", () => {
    expect(hasPermission(userWithRole("SALES"), "INVOICES_CREATE")).toBe(true);
  });
  it("ACCOUNTANT peut lire", () => {
    expect(hasPermission(userWithRole("ACCOUNTANT"), "INVOICES_READ")).toBe(true);
  });
  it("OWNER peut valider", () => {
    expect(hasPermission(userWithRole("OWNER"), "INVOICES_VALIDATE")).toBe(true);
  });
  it("ADMIN peut annuler", () => {
    expect(hasPermission(userWithRole("ADMIN"), "INVOICES_CANCEL")).toBe(true);
  });
});
