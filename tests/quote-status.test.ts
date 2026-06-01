import { describe, expect, it } from "vitest";
import {
  canAcceptQuote,
  canConvertQuote,
  canRefuseQuote,
  isQuoteEditable,
} from "@/lib/quote-status";

describe("quote status", () => {
  it("DRAFT est modifiable", () => {
    expect(isQuoteEditable("DRAFT")).toBe(true);
  });

  it("ACCEPTED n'est pas modifiable", () => {
    expect(isQuoteEditable("ACCEPTED")).toBe(false);
  });

  it("SENT peut être accepté", () => {
    expect(canAcceptQuote("SENT")).toBe(true);
  });

  it("REFUSED ne peut pas être accepté", () => {
    expect(canAcceptQuote("REFUSED")).toBe(false);
  });

  it("ACCEPTED peut être converti", () => {
    expect(canConvertQuote("ACCEPTED")).toBe(true);
  });

  it("DRAFT ne peut pas être converti directement", () => {
    expect(canConvertQuote("DRAFT")).toBe(false);
  });

  it("VIEWED peut être refusé", () => {
    expect(canRefuseQuote("VIEWED")).toBe(true);
  });
});
