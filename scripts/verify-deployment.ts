#!/usr/bin/env tsx
/**
 * Vérifications pré-déploiement (staging / production).
 * Usage : APP_ENV=staging tsx scripts/verify-deployment.ts
 */
import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

const prisma = new PrismaClient();

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function ok(message: string) {
  console.log(`✅ ${message}`);
}

async function main() {
  const appEnv = process.env.APP_ENV ?? "development";
  console.log(`\n🔍 Vérification déploiement (APP_ENV=${appEnv})\n`);

  if (!process.env.DATABASE_URL) {
    fail("DATABASE_URL manquant");
  }
  ok("DATABASE_URL présent");

  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    fail("SESSION_SECRET manquant ou < 32 caractères");
  }
  ok("SESSION_SECRET valide");

  if (appEnv === "production" || appEnv === "staging") {
    if (process.env.SEED_DEV_DATA === "true") {
      fail("SEED_DEV_DATA ne doit pas être true");
    }
    if (process.env.ENABLE_DEV_LOGIN === "true") {
      fail("ENABLE_DEV_LOGIN ne doit pas être true");
    }
    ok("Garde-fous dev désactivés");

    if (!process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")) {
      fail("NEXT_PUBLIC_APP_URL doit être en HTTPS");
    }
    ok("NEXT_PUBLIC_APP_URL HTTPS");

    const storage = process.env.STORAGE_PROVIDER ?? "local";
    if (storage === "s3") {
      for (const key of ["S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_REGION"]) {
        if (!process.env[key]) fail(`${key} requis avec STORAGE_PROVIDER=s3`);
      }
      ok("Configuration S3/R2 complète");
    } else if (appEnv === "production") {
      console.warn("⚠️  STORAGE_PROVIDER=local en production — non recommandé");
    }

    const emailProvider = process.env.EMAIL_PROVIDER ?? (appEnv === "production" ? "resend" : "log");
    if (emailProvider === "resend") {
      if (!process.env.EMAIL_FROM) fail("EMAIL_FROM requis");
      if (!process.env.RESEND_API_KEY) fail("RESEND_API_KEY requis");
      ok("Configuration email Resend");
    }
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    ok("Connexion PostgreSQL");
  } catch (e) {
    fail(`PostgreSQL inaccessible : ${e instanceof Error ? e.message : e}`);
  }

  try {
    const status = execSync("npx prisma migrate status", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (status.includes("following migration have not yet been applied")) {
      fail("Migrations Prisma en attente — exécutez npm run db:migrate:deploy");
    }
    ok("Migrations Prisma à jour");
  } catch {
    console.warn("⚠️  Impossible de vérifier prisma migrate status (continuer manuellement)");
  }

  console.log("\n✅ Vérifications pré-déploiement terminées.\n");
}

main()
  .catch((e) => fail(e instanceof Error ? e.message : String(e)))
  .finally(() => prisma.$disconnect());
