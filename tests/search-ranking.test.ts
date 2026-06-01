import { describe, expect, it } from "vitest";
import { applyRanking, rankSearchResult } from "@/lib/search/search-ranking";
import type { SearchResult } from "@/lib/search/search-types";

const base: SearchResult = {
  id: "1",
  type: "INVOICE",
  title: "FAC-2026-0042",
  href: "/invoices/1",
  score: 0,
  metadata: { numberValue: "FAC-2026-0042" },
};

describe("search ranking", () => {
  it("match exact numéro score plus haut", () => {
    const exact = rankSearchResult(base, "FAC-2026-0042");
    const partial = rankSearchResult(
      { ...base, title: "Facture client", metadata: {} },
      "FAC-2026-0042",
    );
    expect(exact).toBeGreaterThan(partial);
  });

  it("match début de nom score plus haut que description", () => {
    const name = rankSearchResult({ ...base, title: "Atelier Lumière", metadata: {} }, "atel");
    const desc = rankSearchResult(
      {
        ...base,
        title: "Facture",
        description: "atelier partenaire",
        metadata: {},
      },
      "atel",
    );
    expect(name).toBeGreaterThan(desc);
  });

  it("favori ajoute un bonus", () => {
    const withFav = rankSearchResult(base, "fac", { isFavorite: true });
    const without = rankSearchResult(base, "fac", { isFavorite: false });
    expect(withFav).toBeGreaterThan(without);
  });

  it("résultats triés par score décroissant", () => {
    const ranked = applyRanking(
      [
        { ...base, id: "a", score: 0, title: "zzz" },
        { ...base, id: "b", score: 0, title: "FAC-2026-0042", metadata: { numberValue: "FAC-2026-0042" } },
      ],
      "FAC-2026-0042",
      new Set(),
    );
    expect(ranked[0].id).toBe("b");
  });
});
