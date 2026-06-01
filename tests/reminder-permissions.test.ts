import { describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";

describe("reminder permissions", () => {
  it("READ_ONLY peut lire", () => {
    expect(hasPermission({ permissions: ["REMINDERS_READ"] }, "REMINDERS_READ")).toBe(true);
  });

  it("READ_ONLY ne peut pas envoyer", () => {
    expect(hasPermission({ permissions: ["REMINDERS_READ"] }, "REMINDERS_SEND")).toBe(false);
  });

  it("SALES peut envoyer une relance", () => {
    expect(hasPermission({ permissions: ["REMINDERS_SEND"] }, "REMINDERS_SEND")).toBe(true);
  });

  it("ACCOUNTANT peut suspendre le recouvrement", () => {
    expect(hasPermission({ permissions: ["REMINDERS_UPDATE"] }, "REMINDERS_UPDATE")).toBe(true);
  });
});
