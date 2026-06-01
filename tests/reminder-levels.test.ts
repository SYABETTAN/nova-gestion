import { describe, expect, it } from "vitest";
import {
  getDaysOverdue,
  getRecommendedReminderLevel,
  shouldInvoiceBeReminded,
} from "@/lib/collection-utils";

describe("reminder levels", () => {
  it("1 à 7 jours retourne FRIENDLY", () => {
    expect(getRecommendedReminderLevel(5)).toBe("FRIENDLY");
  });

  it("8 à 30 jours retourne FIRST_NOTICE", () => {
    expect(getRecommendedReminderLevel(15)).toBe("FIRST_NOTICE");
  });

  it("31 à 60 jours retourne SECOND_NOTICE", () => {
    expect(getRecommendedReminderLevel(45)).toBe("SECOND_NOTICE");
  });

  it("Plus de 60 jours retourne FINAL_NOTICE", () => {
    expect(getRecommendedReminderLevel(90)).toBe("FINAL_NOTICE");
  });

  it("Une facture non échue retourne 0 jour de retard", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    expect(getDaysOverdue(future)).toBe(0);
  });
});
