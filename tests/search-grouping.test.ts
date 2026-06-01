import { describe, expect, it } from "vitest";
import { groupSearchResults } from "@/lib/search/search-service";
import type { SearchResult } from "@/lib/search/search-types";

describe("search grouping", () => {
  const results: SearchResult[] = [
    { id: "1", type: "CUSTOMER", title: "A", href: "/c/1", score: 10 },
    { id: "2", type: "CUSTOMER", title: "B", href: "/c/2", score: 9 },
    { id: "3", type: "INVOICE", title: "F", href: "/i/1", score: 8 },
  ];

  it("groupe les résultats par type", () => {
    const groups = groupSearchResults(results, 5);
    expect(groups.find((g) => g.type === "CUSTOMER")?.results).toHaveLength(2);
    expect(groups.find((g) => g.type === "INVOICE")?.results).toHaveLength(1);
  });

  it("masque les groupes vides", () => {
    const groups = groupSearchResults(results, 5);
    expect(groups.find((g) => g.type === "QUOTE")).toBeUndefined();
  });

  it("limite les résultats par groupe", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      type: "CUSTOMER" as const,
      title: `C${i}`,
      href: `/c/${i}`,
      score: i,
    }));
    const groups = groupSearchResults(many, 3);
    expect(groups[0].results).toHaveLength(3);
  });

  it("conserve le score", () => {
    const groups = groupSearchResults(results, 5);
    expect(groups[0].results[0].score).toBe(10);
  });
});
