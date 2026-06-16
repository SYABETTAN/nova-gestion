#!/usr/bin/env tsx
/**
 * Import idempotent des données réelles Esther (clients, fournisseurs, produits, PDF).
 *
 * Usage :
 *   npm run import:esther-real-data
 *   ORGANIZATION_SLUG=nova-gestion npm run import:esther-real-data
 *   ORGANIZATION_ID=clxxx npm run import:esther-real-data
 *   ESTHER_REAL_DATA_DIR=/chemin/vers/data npm run import:esther-real-data
 *   npm run import:esther-real-data -- --dry-run
 */
import { PrismaClient } from "@prisma/client";
import {
  formatImportReport,
  importEstherRealData,
  resolveEstherDataDir,
} from "@/lib/esther-real-data/import";

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const organizationId = readArg("--org-id") ?? process.env.ORGANIZATION_ID;
  const organizationSlug = readArg("--org-slug") ?? process.env.ORGANIZATION_SLUG;
  const dataDir = readArg("--data-dir") ?? process.env.ESTHER_REAL_DATA_DIR;

  console.log("📥 Import données réelles Esther");
  console.log(`   Répertoire source : ${resolveEstherDataDir(dataDir)}`);
  if (dryRun) console.log("   Mode : dry-run (aucune écriture)");

  const prisma = new PrismaClient();
  try {
    const report = await importEstherRealData(prisma, {
      organizationId,
      organizationSlug,
      dataDir,
      dryRun,
    });

    console.log("\n" + formatImportReport(report));
    console.log("\n✅ Import terminé.");
    if (!dryRun) {
      console.log(
        "Les données réelles Esther ont été importées de façon idempotente : clients, fournisseur, produits, documents PDF et informations légales sont maintenant disponibles dans la base.",
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("❌ Échec import Esther:", error);
  process.exit(1);
});
