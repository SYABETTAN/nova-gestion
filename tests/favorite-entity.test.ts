import { describe, expect, it } from "vitest";
import { favoriteKey } from "@/lib/search/search-utils";

describe("favorite entity", () => {
  it("génère une clé unique", () => {
    expect(favoriteKey("CUSTOMER", "abc")).toBe("CUSTOMER:abc");
  });

  it("empêche doublon logique", () => {
    const existing = new Set(["CUSTOMER:abc"]);
    const key = favoriteKey("CUSTOMER", "abc");
    expect(existing.has(key)).toBe(true);
  });

  it("retire un favori", () => {
    const set = new Set(["CUSTOMER:abc"]);
    set.delete("CUSTOMER:abc");
    expect(set.has("CUSTOMER:abc")).toBe(false);
  });
});
