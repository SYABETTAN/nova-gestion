import { describe, expect, it } from "vitest";
import { filterSuppliersByText } from "@/lib/supplier-utils";

describe("supplier filters", () => {
  const suppliers = [
    { id: "1", name: "HexaCloud", supplierNumber: "FOU-0001", email: "a@demo.local", status: "ACTIVE", type: "COMPANY", riskLevel: "LOW", isPreferred: true },
    { id: "2", name: "Transport Mercure", supplierNumber: "FOU-0002", email: null, status: "INACTIVE", type: "COMPANY", riskLevel: "HIGH", isPreferred: false },
  ];

  it("Filtre par statut", () => {
    expect(filterSuppliersByText(suppliers, { status: "ACTIVE" })).toHaveLength(1);
  });

  it("Filtre par type", () => {
    expect(filterSuppliersByText(suppliers, { type: "COMPANY" })).toHaveLength(2);
  });

  it("Filtre par texte", () => {
    expect(filterSuppliersByText(suppliers, { q: "Hexa" })).toHaveLength(1);
  });

  it("Filtre par risque", () => {
    expect(filterSuppliersByText(suppliers, { riskLevel: "HIGH" })).toHaveLength(1);
  });

  it("Filtre par fournisseur préféré", () => {
    expect(filterSuppliersByText(suppliers, { preferred: "true" })).toHaveLength(1);
  });
});
