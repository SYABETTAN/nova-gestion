#!/usr/bin/env tsx
/**
 * Migre les noms d'organisation hérités (Nova Gestion / nova-gestion) vers Joey & Joey.
 * Usage : npm run migrate:legacy-branding
 */
import { PrismaClient } from "@prisma/client";
import { migrateLegacyOrganizationBranding } from "../lib/organization-display";

const prisma = new PrismaClient();

async function main() {
  const result = await migrateLegacyOrganizationBranding(prisma);
  console.log(`✅ Branding migré : ${result.organizations} organisation(s), ${result.users} utilisateur(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
