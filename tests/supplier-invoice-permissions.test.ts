import { describe, expect, it } from "vitest";
import { getPermissionsForRole, hasPermission } from "@/lib/permissions";

function userWithRole(role: "OWNER" | "ADMIN" | "ACCOUNTANT" | "SALES" | "READ_ONLY") {
  return { permissions: getPermissionsForRole(role) };
}

describe("supplier invoice permissions", () => {
  it("READ_ONLY ne peut pas créer", () => {
    expect(hasPermission(userWithRole("READ_ONLY"), "SUPPLIER_INVOICES_CREATE")).toBe(false);
    expect(hasPermission(userWithRole("READ_ONLY"), "SUPPLIER_INVOICES_READ")).toBe(true);
  });

  it("SALES n'a pas accès par défaut", () => {
    expect(hasPermission(userWithRole("SALES"), "SUPPLIER_INVOICES_READ")).toBe(false);
    expect(hasPermission(userWithRole("SALES"), "SUPPLIER_INVOICES_CREATE")).toBe(false);
  });

  it("ACCOUNTANT peut créer", () => {
    expect(hasPermission(userWithRole("ACCOUNTANT"), "SUPPLIER_INVOICES_CREATE")).toBe(true);
  });

  it("ACCOUNTANT peut valider", () => {
    expect(hasPermission(userWithRole("ACCOUNTANT"), "SUPPLIER_INVOICES_VALIDATE")).toBe(true);
  });

  it("OWNER peut annuler", () => {
    expect(hasPermission(userWithRole("OWNER"), "SUPPLIER_INVOICES_CANCEL")).toBe(true);
  });
});
