import { describe, expect, it } from "vitest";
import { createExpenseCategorySchema } from "@/lib/supplier-invoice-validators";

describe("expense category", () => {
  it("crée une catégorie valide", () => {
    const result = createExpenseCategorySchema.safeParse({
      name: "Logiciels",
      description: "Abonnements SaaS",
      color: "#3b82f6",
    });
    expect(result.success).toBe(true);
  });

  it("defaultVatRate par défaut est 20", () => {
    const result = createExpenseCategorySchema.parse({ name: "Transport" });
    expect(result.defaultVatRate).toBe(20);
  });

  it("une catégorie inactive peut être masquée des formulaires", () => {
    const categories = [
      { id: "1", name: "Actif", isActive: true },
      { id: "2", name: "Inactif", isActive: false },
    ];
    const active = categories.filter((c) => c.isActive);
    expect(active).toHaveLength(1);
    expect(active[0]?.name).toBe("Actif");
  });
});
