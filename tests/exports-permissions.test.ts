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

describe("exports and documents permissions", () => {
  it("READ_ONLY peut voir exports et documents", () => {
    const user = mockUser("READ_ONLY");
    expect(hasPermission(user, "EXPORTS_READ")).toBe(true);
    expect(hasPermission(user, "DOCUMENTS_READ")).toBe(true);
  });

  it("READ_ONLY ne peut pas créer de template", () => {
    const user = mockUser("READ_ONLY");
    expect(hasPermission(user, "DOCUMENT_TEMPLATES_UPDATE")).toBe(false);
  });

  it("ACCOUNTANT peut exporter la comptabilité", () => {
    const user = mockUser("ACCOUNTANT");
    expect(hasPermission(user, "ACCOUNTING_EXPORT")).toBe(true);
    expect(hasPermission(user, "EXPORTS_CREATE")).toBe(true);
  });

  it("SALES peut exporter devis et factures", () => {
    const user = mockUser("SALES");
    expect(hasPermission(user, "QUOTES_READ")).toBe(true);
    expect(hasPermission(user, "INVOICES_READ")).toBe(true);
    expect(hasPermission(user, "EXPORTS_CREATE")).toBe(true);
  });

  it("OWNER peut tout faire", () => {
    const user = mockUser("OWNER");
    expect(hasPermission(user, "DOCUMENT_TEMPLATES_UPDATE")).toBe(true);
    expect(hasPermission(user, "DOCUMENTS_ARCHIVE")).toBe(true);
  });
});
