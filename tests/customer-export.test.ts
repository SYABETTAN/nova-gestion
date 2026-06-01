import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { CUSTOMER_CSV_HEADERS, escapeCsvValue, generateCustomersCsv } from "@/lib/csv";

describe("CSV export", () => {
  it("génère un CSV avec headers", () => {
    const csv = generateCustomersCsv([]);
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toBe(CUSTOMER_CSV_HEADERS.join(","));
  });

  it("inclut les champs attendus", () => {
    const csv = generateCustomersCsv([
      {
        id: "1",
        organizationId: "org",
        customerNumber: "CLI-0001",
        type: "COMPANY",
        status: "ACTIVE",
        name: "Test, \"Quoted\" Corp",
        legalName: "Test Corp SAS",
        displayName: null,
        email: "test@demo.local",
        phone: "+33 1 23 45 67 89",
        website: null,
        siret: "12345678900012",
        vatNumber: "FR12123456789",
        legalForm: "SAS",
        industry: null,
        employeeCount: null,
        annualRevenue: null,
        defaultPaymentTermsDays: 30,
        defaultVatRate: new Prisma.Decimal(20),
        currency: "EUR",
        creditLimit: new Prisma.Decimal(5000),
        outstandingAmount: new Prisma.Decimal(1250.5),
        notes: null,
        isArchived: false,
        archivedAt: null,
        createdAt: new Date("2026-01-15T10:00:00.000Z"),
        updatedAt: new Date("2026-01-15T10:00:00.000Z"),
        addresses: [{ city: "Paris", country: "FR", isDefault: true }],
      },
    ]);

    expect(csv).toContain("CLI-0001");
    expect(csv).toContain("Paris");
    expect(csv).toContain('"Test, ""Quoted"" Corp"');
  });

  it("échappe correctement les virgules et guillemets", () => {
    expect(escapeCsvValue('hello, "world"')).toBe('"hello, ""world"""');
    expect(escapeCsvValue("simple")).toBe("simple");
  });
});
