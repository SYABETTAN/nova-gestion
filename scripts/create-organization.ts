#!/usr/bin/env tsx
/**
 * Crée une organisation client + utilisateur OWNER (hors inscription publique).
 *
 * Usage :
 *   npm run org:create -- --name "Acme SAS" --email "owner@acme.fr" --password "MotDePasseSecurise123!"
 */
import { PrismaClient } from "@prisma/client";
import { createOrganizationWithOwner } from "@/lib/organization-create";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const name = readArg("--name");
  const email = readArg("--email");
  const password = readArg("--password");

  if (!name || !email || !password) {
    console.error(
      "Usage: npm run org:create -- --name \"Organisation\" --email \"owner@client.fr\" --password \"********\"",
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Le mot de passe doit contenir au moins 8 caractères.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const ownerRole = await prisma.role.findUnique({ where: { key: "OWNER" } });
    if (!ownerRole) {
      console.error("Rôles non seedés — exécutez npm run db:seed");
      process.exit(1);
    }

    const result = await createOrganizationWithOwner(name, email, password);
    if (!result.success) {
      console.error(result.error);
      process.exit(1);
    }

    console.log("Organisation créée avec succès.");
    console.log(`  Organisation : ${result.organizationName} (${result.organizationId})`);
    console.log(`  Propriétaire  : ${email} (${result.userId})`);
    console.log("Le client peut se connecter via /login.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
