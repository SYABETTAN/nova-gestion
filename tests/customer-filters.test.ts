import { describe, expect, it } from "vitest";
import {
  computeCustomerStats,
  formatCustomerDisplayName,
  getCustomerStatusColor,
  getCustomerStatusLabel,
} from "@/lib/customer-utils";
import { filterCustomersByTag, filterCustomersByText } from "@/lib/customers";

describe("customer utilities", () => {
  it("formatCustomerDisplayName fonctionne", () => {
    expect(
      formatCustomerDisplayName({ displayName: "Affichage", name: "Nom", legalName: "Légal" }),
    ).toBe("Affichage");
    expect(formatCustomerDisplayName({ displayName: null, name: "Nom", legalName: "Légal" })).toBe(
      "Nom",
    );
  });

  it("getCustomerStatusLabel retourne le bon label", () => {
    expect(getCustomerStatusLabel("PROSPECT")).toBe("Prospect");
    expect(getCustomerStatusLabel("ACTIVE")).toBe("Client actif");
  });

  it("getCustomerStatusColor retourne une valeur cohérente", () => {
    expect(getCustomerStatusColor("ACTIVE")).toContain("emerald");
    expect(getCustomerStatusColor("ARCHIVED")).toContain("red");
  });

  it("computeCustomerStats calcule total, prospects, actifs, encours", () => {
    const stats = computeCustomerStats([
      { status: "PROSPECT", outstandingAmount: 100, isArchived: false },
      { status: "ACTIVE", outstandingAmount: 200, isArchived: false },
      { status: "ACTIVE", outstandingAmount: 300, isArchived: false },
      { status: "ARCHIVED", outstandingAmount: 999, isArchived: true },
    ]);
    expect(stats.total).toBe(3);
    expect(stats.prospects).toBe(1);
    expect(stats.active).toBe(2);
    expect(stats.totalOutstanding).toBe(600);
  });
});

describe("customer filters", () => {
  const customers = [
    {
      name: "Alpha Corp",
      customerNumber: "CLI-0001",
      email: "a@test.local",
      status: "PROSPECT",
      type: "COMPANY",
      tagAssignments: [{ tagId: "tag-1" }],
    },
    {
      name: "Beta SARL",
      customerNumber: "CLI-0002",
      email: "b@example.com",
      status: "ACTIVE",
      type: "COMPANY",
      tagAssignments: [{ tagId: "tag-2" }],
    },
    {
      name: "Charlie",
      customerNumber: "CLI-0003",
      email: "c@test.local",
      status: "ACTIVE",
      type: "INDIVIDUAL",
      tagAssignments: [{ tagId: "tag-1" }],
    },
  ];

  it("filtre par statut", () => {
    const result = filterCustomersByText(customers, { status: "PROSPECT" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alpha Corp");
  });

  it("filtre par type", () => {
    const result = filterCustomersByText(customers, { type: "INDIVIDUAL" });
    expect(result).toHaveLength(1);
  });

  it("filtre par texte", () => {
    const result = filterCustomersByText(customers, { q: "beta" });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Beta SARL");
  });

  it("filtre par tag", () => {
    const result = filterCustomersByTag(customers, "tag-1");
    expect(result).toHaveLength(2);
  });
});
