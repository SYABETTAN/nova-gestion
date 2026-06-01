import { describe, expect, it } from "vitest";
import { canDisableFeatureFlag } from "@/lib/feature-flags";

describe("feature flags", () => {
  it("advancedSettings ne peut pas être désactivé", () => {
    expect(canDisableFeatureFlag("advancedSettings")).toBe(false);
  });

  it("customers peut être désactivé", () => {
    expect(canDisableFeatureFlag("customers")).toBe(true);
  });

  it("feature activée / désactivée", () => {
    const enabled = { enabled: true };
    const disabled = { enabled: false };
    expect(enabled.enabled).toBe(true);
    expect(disabled.enabled).toBe(false);
  });
});
