import { describe, expect, it } from "vitest";
import {
  formatNumberPreview,
  replaceDateTokens,
  shouldResetSequence,
} from "@/lib/numbering";

describe("numbering", () => {
  const fixedDate = new Date("2026-05-29T10:00:00");

  it("génère un numéro avec préfixe", () => {
    const result = formatNumberPreview(
      {
        prefix: "CLI-",
        nextNumber: 24,
        padding: 4,
        suffix: "",
        resetPeriod: "NEVER",
      },
      fixedDate,
    );
    expect(result).toBe("CLI-0024");
  });

  it("remplace {YYYY}", () => {
    expect(replaceDateTokens("DEV-{YYYY}-", fixedDate)).toBe("DEV-2026-");
  });

  it("respecte le padding", () => {
    const result = formatNumberPreview(
      {
        prefix: "ECR-{YYYY}-",
        nextNumber: 73,
        padding: 5,
        suffix: "",
        resetPeriod: "YEARLY",
      },
      fixedDate,
    );
    expect(result).toBe("ECR-2026-00073");
  });

  it("génère un aperçu correct pour facture", () => {
    const result = formatNumberPreview(
      {
        prefix: "FAC-{YYYY}-",
        nextNumber: 42,
        padding: 4,
        suffix: "",
        resetPeriod: "YEARLY",
      },
      fixedDate,
    );
    expect(result).toBe("FAC-2026-0042");
  });

  it("shouldResetSequence détecte une réinitialisation annuelle", () => {
    const lastReset = new Date("2025-06-01");
    expect(shouldResetSequence("YEARLY", lastReset, fixedDate)).toBe(true);
    expect(shouldResetSequence("NEVER", lastReset, fixedDate)).toBe(false);
  });
});
