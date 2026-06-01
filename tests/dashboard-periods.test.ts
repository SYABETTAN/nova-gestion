import { describe, expect, it } from "vitest";
import {
  getDateRangeFromPreset,
  formatPeriodLabel,
  getPreviousPeriodRange,
} from "@/lib/dashboard-periods";
import { dashboardPeriodFilterSchema } from "@/lib/dashboard-validators";

describe("dashboard periods", () => {
  it("Ce mois retourne le bon début et fin de mois", () => {
    const range = getDateRangeFromPreset("THIS_MONTH");
    expect(range.startDate.getDate()).toBe(1);
    expect(range.endDate.getMonth()).toBe(range.startDate.getMonth());
    expect(range.endDate.getDate()).toBeGreaterThan(27);
  });

  it("Mois précédent retourne la bonne période", () => {
    const range = getDateRangeFromPreset("LAST_MONTH");
    const now = new Date();
    const expectedMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    expect(range.startDate.getMonth()).toBe(expectedMonth);
  });

  it("Cette année retourne du 1er janvier au 31 décembre", () => {
    const range = getDateRangeFromPreset("THIS_YEAR");
    const year = new Date().getFullYear();
    expect(range.startDate).toEqual(new Date(year, 0, 1, 0, 0, 0, 0));
    expect(range.endDate.getMonth()).toBe(11);
    expect(range.endDate.getDate()).toBe(31);
  });

  it("Custom exige startDate et endDate", () => {
    const result = dashboardPeriodFilterSchema.safeParse({ preset: "CUSTOM" });
    expect(result.success).toBe(false);
  });

  it("endDate avant startDate est refusé", () => {
    const result = dashboardPeriodFilterSchema.safeParse({
      preset: "CUSTOM",
      startDate: new Date("2025-06-01"),
      endDate: new Date("2025-05-01"),
    });
    expect(result.success).toBe(false);
  });

  it("formatPeriodLabel affiche un libellé pour ce mois", () => {
    const range = getDateRangeFromPreset("THIS_MONTH");
    expect(formatPeriodLabel(range)).toBe("Ce mois");
  });

  it("getPreviousPeriodRange précède la période courante", () => {
    const range = getDateRangeFromPreset("THIS_MONTH");
    const prev = getPreviousPeriodRange(range);
    expect(prev.endDate.getTime()).toBeLessThan(range.startDate.getTime());
  });
});
