import { describe, expect, it } from "vitest";
import { REMINDERS_CSV_HEADERS, escapeCsvValue, generateRemindersCsv } from "@/lib/csv";

describe("reminder CSV export", () => {
  it("Génère un CSV avec headers", () => {
    expect(generateRemindersCsv([]).split("\n")[0]).toBe(REMINDERS_CSV_HEADERS.join(","));
  });

  it("Échappe correctement les virgules", () => {
    expect(escapeCsvValue("Client, SAS")).toBe('"Client, SAS"');
  });
});
