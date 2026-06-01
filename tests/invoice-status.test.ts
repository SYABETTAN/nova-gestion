import { describe, expect, it } from "vitest";
import { canCreateCreditNote, canValidateInvoice, isInvoiceEditable } from "@/lib/invoice-status";

describe("invoice status", () => {
  it("DRAFT est modifiable", () => expect(isInvoiceEditable("DRAFT")).toBe(true));
  it("VALIDATED n'est pas modifiable", () => expect(isInvoiceEditable("VALIDATED")).toBe(false));
  it("DRAFT peut être validée", () => expect(canValidateInvoice("DRAFT")).toBe(true));
  it("SENT peut être marquée payée via canCreateCreditNote false for draft", () => expect(canCreateCreditNote("SENT")).toBe(true));
  it("PAID ne peut pas être modifiée", () => expect(isInvoiceEditable("PAID")).toBe(false));
  it("VALIDATED peut recevoir un avoir", () => expect(canCreateCreditNote("VALIDATED")).toBe(true));
  it("CANCELLED ne peut pas être modifiée", () => expect(isInvoiceEditable("CANCELLED")).toBe(false));
});
