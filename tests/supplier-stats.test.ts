import { describe, expect, it } from "vitest";
import {
  computeSupplierStats,
  formatSupplierDisplayName,
  getSupplierRiskLabel,
  getSupplierStatusLabel,
} from "@/lib/supplier-utils";

describe("supplier utilities", () => {
  it("formatSupplierDisplayName fonctionne", () => {
    expect(formatSupplierDisplayName({ displayName: "Hexa", name: "HexaCloud", legalName: null })).toBe("Hexa");
  });

  it("getSupplierStatusLabel retourne le bon label", () => {
    expect(getSupplierStatusLabel("ACTIVE")).toBe("Actif");
  });

  it("getSupplierRiskLabel retourne le bon label", () => {
    expect(getSupplierRiskLabel("HIGH")).toBe("Risque élevé");
  });

  it("computeSupplierStats calcule total, actifs, préférés, encours, achats", () => {
    const stats = computeSupplierStats([
      { status: "ACTIVE", outstandingAmount: 500, totalPurchasesAmount: 10000, isArchived: false, isPreferred: true, riskLevel: "LOW", defaultPaymentTermsDays: 30 },
      { status: "INACTIVE", outstandingAmount: 200, totalPurchasesAmount: 5000, isArchived: false, isPreferred: false, riskLevel: "MEDIUM", defaultPaymentTermsDays: 45 },
      { status: "ARCHIVED", outstandingAmount: 1000, totalPurchasesAmount: 20000, isArchived: true, isPreferred: false, riskLevel: "HIGH", defaultPaymentTermsDays: 30 },
    ]);
    expect(stats.total).toBe(2);
    expect(stats.active).toBe(1);
    expect(stats.preferred).toBe(1);
    expect(stats.totalOutstanding).toBe(700);
    expect(stats.totalPurchases).toBe(15000);
  });
});
