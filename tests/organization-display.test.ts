import { describe, expect, it } from "vitest";
import {
  isLegacyOrganizationName,
  resolveOrganizationDisplayName,
  resolveOrganizationLegalName,
} from "@/lib/organization-display";

describe("organization-display", () => {
  it("détecte les noms legacy", () => {
    expect(isLegacyOrganizationName("nova-gestion")).toBe(true);
    expect(isLegacyOrganizationName("Nova Gestion")).toBe(true);
    expect(isLegacyOrganizationName("NovaGestion")).toBe(true);
    expect(isLegacyOrganizationName("novaGestion")).toBe(true);
    expect(isLegacyOrganizationName("Acme SAS")).toBe(false);
  });

  it("remplace les noms legacy par Joey & Joey", () => {
    expect(resolveOrganizationDisplayName("nova-gestion")).toBe("Joey & Joey");
    expect(resolveOrganizationDisplayName("Nova Gestion")).toBe("Joey & Joey");
    expect(resolveOrganizationDisplayName("nova-gestion", "nova-gestion")).toBe("Joey & Joey");
    expect(resolveOrganizationDisplayName("Esther Import")).toBe("Esther Import");
  });

  it("résout le nom légal pour les documents", () => {
    expect(resolveOrganizationLegalName(null, "nova-gestion")).toBe("Joey & Joey SAS");
    expect(resolveOrganizationLegalName("Nova Gestion SAS", "nova-gestion")).toBe("Joey & Joey SAS");
    expect(resolveOrganizationLegalName("Esther SARL", "Esther Import")).toBe("Esther SARL");
  });
});
