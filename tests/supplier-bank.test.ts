import { describe, expect, it } from "vitest";
import { maskIban } from "@/lib/supplier-utils";

describe("bank account validation", () => {
  it("Masque partiellement l'IBAN fictif", () => {
    expect(maskIban("FR7600000000000000000000001")).toContain("****");
  });

  it("Ne fait aucune validation bancaire réelle", () => {
    const fakeIban = "FR76 0000 0000 0000 0000 0000 001";
    expect(fakeIban.startsWith("FR")).toBe(true);
    expect(maskIban(fakeIban).length).toBeGreaterThan(0);
  });
});
