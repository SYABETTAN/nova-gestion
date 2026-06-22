#!/usr/bin/env tsx
/**
 * Crée un utilisateur OWNER minimal pour les tests E2E en CI.
 * Prérequis : npm run db:seed:production (rôles et permissions).
 */
import { PrismaClient } from "@prisma/client";
import { createOrganizationWithOwner } from "@/lib/organization-create";
import {
  CI_E2E_ORG_NAME,
  CI_E2E_OWNER_EMAIL,
  CI_E2E_OWNER_PASSWORD,
} from "@/lib/ci-test-credentials";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: CI_E2E_OWNER_EMAIL },
  });

  if (existing) {
    console.log("✅ Utilisateur CI E2E déjà présent — skip");
    return;
  }

  const ownerRole = await prisma.role.findUnique({ where: { key: "OWNER" } });
  if (!ownerRole) {
    console.error("❌ Rôles absents — exécutez npm run db:seed:production");
    process.exit(1);
  }

  const result = await createOrganizationWithOwner(
    CI_E2E_ORG_NAME,
    CI_E2E_OWNER_EMAIL,
    CI_E2E_OWNER_PASSWORD,
  );

  if (!result.success) {
    console.error("❌", result.error);
    process.exit(1);
  }

  console.log("✅ Organisation CI E2E créée pour Playwright");
  console.log(`   Email : ${CI_E2E_OWNER_EMAIL}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
