import { describe, expect, it } from "vitest";
import { getDefaultLocalization, previewLocalization } from "@/lib/localization";

describe("localization", () => {
  it("retourne fr-FR par défaut", () => {
    expect(getDefaultLocalization().locale).toBe("fr-FR");
    expect(getDefaultLocalization().timezone).toBe("Europe/Paris");
  });

  it("formate une date exemple", () => {
    const preview = previewLocalization("fr-FR", "dd/MM/yyyy");
    expect(preview.date).toBeTruthy();
  });

  it("formate un montant exemple", () => {
    const preview = previewLocalization("fr-FR", "dd/MM/yyyy");
    expect(preview.amount).toContain("€");
  });
});
