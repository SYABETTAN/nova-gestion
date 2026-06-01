import { describe, expect, it } from "vitest";
import { getPermissionsForRole, hasPermission } from "@/lib/permissions";

function userWithRole(role: "OWNER" | "ADMIN" | "ACCOUNTANT" | "SALES" | "READ_ONLY") {
  return { permissions: getPermissionsForRole(role) };
}

describe("accounting permissions", () => {
  it("READ_ONLY peut lire", () => {
    expect(hasPermission(userWithRole("READ_ONLY"), "ACCOUNTING_READ")).toBe(true);
  });

  it("READ_ONLY ne peut pas créer", () => {
    expect(hasPermission(userWithRole("READ_ONLY"), "ACCOUNTING_CREATE")).toBe(false);
  });

  it("SALES n'a pas accès par défaut", () => {
    expect(hasPermission(userWithRole("SALES"), "ACCOUNTING_READ")).toBe(false);
  });

  it("ACCOUNTANT peut créer et valider", () => {
    expect(hasPermission(userWithRole("ACCOUNTANT"), "ACCOUNTING_CREATE")).toBe(true);
    expect(hasPermission(userWithRole("ACCOUNTANT"), "ACCOUNTING_VALIDATE")).toBe(true);
  });

  it("OWNER peut tout faire", () => {
    expect(hasPermission(userWithRole("OWNER"), "ACCOUNTING_CANCEL")).toBe(true);
    expect(hasPermission(userWithRole("OWNER"), "ACCOUNTING_SETTINGS_UPDATE")).toBe(true);
  });
});
