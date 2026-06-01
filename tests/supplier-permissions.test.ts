import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";

describe("supplier permissions", () => {
  it("READ_ONLY ne peut pas créer", () => {
    expect(hasPermission({ permissions: ["SUPPLIERS_READ"] }, "SUPPLIERS_CREATE")).toBe(false);
  });

  it("SALES peut lire uniquement", () => {
    expect(hasPermission({ permissions: ["SUPPLIERS_READ"] }, "SUPPLIERS_READ")).toBe(true);
    expect(hasPermission({ permissions: ["SUPPLIERS_READ"] }, "SUPPLIERS_UPDATE")).toBe(false);
  });

  it("ACCOUNTANT peut créer", () => {
    expect(hasPermission({ permissions: ["SUPPLIERS_CREATE"] }, "SUPPLIERS_CREATE")).toBe(true);
  });

  it("OWNER peut archiver", () => {
    expect(hasPermission({ permissions: ["SUPPLIERS_DELETE"] }, "SUPPLIERS_DELETE")).toBe(true);
  });
});
