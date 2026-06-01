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

describe("quote permissions", () => {
  it("READ_ONLY ne peut pas créer", () => {
    const u = userWithRole("READ_ONLY");
    expect(hasPermission(u, "QUOTES_READ")).toBe(true);
    expect(hasPermission(u, "QUOTES_CREATE")).toBe(false);
  });

  it("SALES peut créer", () => {
    expect(hasPermission(userWithRole("SALES"), "QUOTES_CREATE")).toBe(true);
  });

  it("ACCOUNTANT peut lire", () => {
    const u = userWithRole("ACCOUNTANT");
    expect(hasPermission(u, "QUOTES_READ")).toBe(true);
    expect(hasPermission(u, "QUOTES_CREATE")).toBe(false);
  });

  it("OWNER peut archiver (QUOTES_DELETE)", () => {
    expect(hasPermission(userWithRole("OWNER"), "QUOTES_DELETE")).toBe(true);
  });

  it("SALES peut valider (QUOTES_VALIDATE)", () => {
    expect(hasPermission(userWithRole("SALES"), "QUOTES_VALIDATE")).toBe(true);
  });
});
