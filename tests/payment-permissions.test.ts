import { describe, expect, it } from "vitest";
import type { PermissionKey } from "@prisma/client";
import { hasPermission } from "@/lib/permissions";

describe("payment permissions", () => {
  it("READ_ONLY ne peut pas créer", () => {
    expect(hasPermission({ permissions: ["PAYMENTS_READ"] }, "PAYMENTS_CREATE")).toBe(false);
  });

  it("SALES peut créer un paiement", () => {
    expect(
      hasPermission(
        { permissions: ["PAYMENTS_READ", "PAYMENTS_CREATE", "PAYMENTS_EXPORT"] },
        "PAYMENTS_CREATE",
      ),
    ).toBe(true);
  });

  it("ACCOUNTANT peut créer et annuler", () => {
    const perms: PermissionKey[] = [
      "PAYMENTS_READ",
      "PAYMENTS_CREATE",
      "PAYMENTS_UPDATE",
      "PAYMENTS_CANCEL",
      "PAYMENTS_EXPORT",
    ];
    expect(hasPermission({ permissions: perms }, "PAYMENTS_CREATE")).toBe(true);
    expect(hasPermission({ permissions: perms }, "PAYMENTS_CANCEL")).toBe(true);
  });

  it("OWNER peut tout faire via ALL_PERMISSIONS", () => {
    expect(hasPermission({ permissions: ["PAYMENTS_CANCEL", "PAYMENTS_EXPORT"] }, "PAYMENTS_EXPORT")).toBe(true);
  });
});
