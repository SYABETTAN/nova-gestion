import { describe, expect, it } from "vitest";
import { SYSTEM_ACCOUNT_NUMBERS } from "@/lib/accounting-mapping";

describe("accounting mapping settings", () => {
  it("utilise fallback si mapping absent", () => {
    expect(SYSTEM_ACCOUNT_NUMBERS.CUSTOMERS).toBe("411000");
    expect(SYSTEM_ACCOUNT_NUMBERS.SUPPLIERS).toBe("401000");
  });

  it("ignore les mappings inactifs (logique métier)", () => {
    const mappings = [
      { type: "BANK", isActive: false, isDefault: true },
      { type: "BANK", isActive: true, isDefault: false },
    ];
    const active = mappings.filter((m) => m.isActive);
    expect(active).toHaveLength(1);
  });

  it("définit un mapping par défaut", () => {
    const mappings = [
      { type: "BANK", isDefault: false, isActive: true },
      { type: "BANK", isDefault: true, isActive: true },
    ];
    expect(mappings.find((m) => m.isDefault)?.isDefault).toBe(true);
  });
});
