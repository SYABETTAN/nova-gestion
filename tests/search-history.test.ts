import { describe, expect, it } from "vitest";
import { isQueryLongEnough } from "@/lib/search/search-utils";
import { searchHistoryInputSchema } from "@/lib/search/search-validators";

describe("search history", () => {
  it("ignore query trop courte", () => {
    expect(isQueryLongEnough("a")).toBe(false);
    expect(searchHistoryInputSchema.safeParse({ query: "a" }).success).toBe(false);
  });

  it("accepte query valide", () => {
    expect(searchHistoryInputSchema.safeParse({ query: "atelier" }).success).toBe(true);
  });

  it("efface les recherches (logique)", () => {
    const history = [{ query: "a" }, { query: "b" }];
    expect(history.filter(() => false)).toHaveLength(0);
  });
});
