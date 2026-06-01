import { describe, expect, it } from "vitest";
import {
  findExactMatch,
  isQueryLongEnough,
  normalizeSearchQuery,
} from "@/lib/search/search-utils";

describe("search normalization", () => {
  it("convertit en lowercase", () => {
    expect(normalizeSearchQuery("  Atelier  ")).toBe("atelier");
  });

  it("supprime les espaces multiples", () => {
    expect(normalizeSearchQuery("facture   retard")).toBe("facture retard");
  });

  it("gère les accents", () => {
    expect(normalizeSearchQuery("Éléctricité")).toBe("electricite");
  });

  it("retourne query vide proprement", () => {
    expect(normalizeSearchQuery("   ")).toBe("");
    expect(isQueryLongEnough("a")).toBe(false);
    expect(isQueryLongEnough("ab")).toBe(true);
  });

  it("trouve un match exact sur numéro", () => {
    const match = findExactMatch(
      [{ title: "FAC-2026-0042", metadata: { numberValue: "FAC-2026-0042" } }],
      "FAC-2026-0042",
    );
    expect(match?.title).toBe("FAC-2026-0042");
  });
});
