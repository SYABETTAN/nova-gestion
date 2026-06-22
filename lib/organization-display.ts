import type { PrismaClient } from "@prisma/client";
import { APP_DISPLAY_NAME } from "@/lib/branding";

/** Noms d'organisation hérités du rebranding Nova Gestion → Joey & Joey. */
const LEGACY_ORGANIZATION_NAMES = new Set([
  "nova-gestion",
  "nova gestion",
  "nova gestion sas",
  "novagestion",
  "novagestionapp",
  "nova gestion app",
]);

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function isLegacyOrganizationName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  const trimmed = name.trim();
  const normalized = normalizeKey(trimmed);
  if (LEGACY_ORGANIZATION_NAMES.has(trimmed.toLowerCase())) return true;
  if (LEGACY_ORGANIZATION_NAMES.has(normalized)) return true;
  if (normalized === "novagestion" || normalized === "novagestionapp") return true;
  return false;
}

/**
 * Nom affiché pour une organisation (UI, PDF, emails).
 * Remplace les noms hérités ; conserve les noms réels personnalisés.
 */
export function resolveOrganizationDisplayName(
  name: string | null | undefined,
  slug?: string | null,
): string {
  const trimmed = name?.trim();
  if (!trimmed) return APP_DISPLAY_NAME;
  if (isLegacyOrganizationName(trimmed)) return APP_DISPLAY_NAME;
  if (slug === "nova-gestion" && normalizeKey(trimmed) === "novagestion") {
    return APP_DISPLAY_NAME;
  }
  if (slug && normalizeKey(trimmed) === normalizeKey(slug) && slug === "nova-gestion") {
    return APP_DISPLAY_NAME;
  }
  return trimmed;
}

export function resolveOrganizationLegalName(
  legalName: string | null | undefined,
  name: string | null | undefined,
  slug?: string | null,
): string {
  const displayName = resolveOrganizationDisplayName(name, slug);
  const trimmedLegal = legalName?.trim();
  if (!trimmedLegal || isLegacyOrganizationName(trimmedLegal)) {
    return displayName === APP_DISPLAY_NAME ? "Joey & Joey SAS" : displayName;
  }
  if (isLegacyOrganizationName(name)) return "Joey & Joey SAS";
  return trimmedLegal;
}

export type OrganizationBrandingFields = {
  name: string;
  legalName?: string | null;
  slug?: string | null;
};

export function organizationNameForDocuments(org: OrganizationBrandingFields): string {
  return resolveOrganizationLegalName(org.legalName, org.name, org.slug);
}

export function resolveOrganizationBranding(org: OrganizationBrandingFields) {
  const displayName = resolveOrganizationDisplayName(org.name, org.slug);
  const legalDisplayName = resolveOrganizationLegalName(org.legalName, org.name, org.slug);
  return { displayName, legalDisplayName };
}

export async function migrateLegacyOrganizationBranding(
  prisma: PrismaClient,
): Promise<{ organizations: number; users: number }> {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      legalName: true,
      slug: true,
      email: true,
      website: true,
      defaultInvoiceFooter: true,
    },
  });

  let organizations = 0;
  for (const org of orgs) {
    const needsNameFix =
      isLegacyOrganizationName(org.name) ||
      (org.slug === "nova-gestion" && normalizeKey(org.name) === normalizeKey(org.slug));

    if (!needsNameFix) continue;

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: APP_DISPLAY_NAME,
        legalName: isLegacyOrganizationName(org.legalName) ? "Joey & Joey SAS" : org.legalName,
        email: org.email?.includes("nova-gestion") ? "contact@joey-and-joey.example" : org.email,
        website: org.website?.includes("nova-gestion") ? "https://joey-and-joey.example" : org.website,
        defaultInvoiceFooter: org.defaultInvoiceFooter?.includes("Nova Gestion")
          ? "Joey & Joey SAS — SIRET 12345678900012 — TVA FR12123456789"
          : org.defaultInvoiceFooter,
      },
    });
    organizations += 1;
  }

  const users = await prisma.user.updateMany({
    where: {
      OR: [
        { name: { equals: "nova-gestion", mode: "insensitive" } },
        { name: { equals: "Nova Gestion", mode: "insensitive" } },
        { name: { equals: "NovaGestion", mode: "insensitive" } },
        { name: { equals: "novaGestion", mode: "insensitive" } },
      ],
    },
    data: { name: "Propriétaire" },
  });

  return { organizations, users: users.count };
}
