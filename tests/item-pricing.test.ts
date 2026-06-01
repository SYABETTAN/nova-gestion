import { describe, expect, it } from "vitest";
import {
  calculateMarginAmount,
  calculateMarginRate,
  calculatePriceIncludingTax,
  roundMoney,
} from "@/lib/pricing";

describe("pricing utilities", () => {
  it("calculatePriceIncludingTax fonctionne", () => {
    expect(calculatePriceIncludingTax(100, 20)).toBe(120);
  });

  it("calculateMarginAmount fonctionne", () => {
    expect(calculateMarginAmount(100, 60)).toBe(40);
  });

  it("calculateMarginRate fonctionne", () => {
    expect(calculateMarginRate(100, 60)).toBe(40);
  });

  it("Taux de marge = 0 si prix de vente HT = 0", () => {
    expect(calculateMarginRate(0, 50)).toBe(0);
  });

  it("Les montants sont arrondis à 2 décimales", () => {
    expect(roundMoney(10.556)).toBe(10.56);
    expect(calculatePriceIncludingTax(99.99, 20)).toBe(119.99);
  });
});
