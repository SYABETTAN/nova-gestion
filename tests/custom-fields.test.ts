import { describe, expect, it } from "vitest";
import {
  generateCustomFieldKey,
  validateCustomFieldSelectOptions,
} from "@/lib/custom-fields";
import { createCustomFieldSchema } from "@/lib/settings-validators";

describe("custom fields", () => {
  it("génère une key depuis label", () => {
    expect(generateCustomFieldKey("Source d'acquisition")).toBe("source_d_acquisition");
  });

  it("SELECT exige options", () => {
    expect(validateCustomFieldSelectOptions("SELECT", null)).toBe(false);
    expect(
      createCustomFieldSchema.safeParse({
        entityType: "CUSTOMER",
        label: "Segment",
        fieldType: "SELECT",
      }).success,
    ).toBe(false);
  });

  it("empêche doublon key par entité", () => {
    const existing = [{ entityType: "CUSTOMER", key: "segment" }];
    const duplicate = existing.some((f) => f.entityType === "CUSTOMER" && f.key === "segment");
    expect(duplicate).toBe(true);
  });
});
