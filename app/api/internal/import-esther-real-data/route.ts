import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  formatImportReport,
  importEstherRealData,
} from "@/lib/esther-real-data/import";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorizeImport(request: NextRequest): boolean {
  const secret = process.env.DATA_IMPORT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;

  const token = header.slice("Bearer ".length);
  if (token.length !== secret.length) return false;

  return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
}

/**
 * Lance l'import Esther sur l'environnement hébergé (accès DB Neon côté Vercel).
 * POST /api/internal/import-esther-real-data?orgSlug=nova-gestion
 * Authorization: Bearer <SESSION_SECRET ou DATA_IMPORT_SECRET>
 */
export async function POST(request: NextRequest) {
  if (!authorizeImport(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgSlug =
    request.nextUrl.searchParams.get("orgSlug") ??
    process.env.ORGANIZATION_SLUG ??
    "nova-gestion";
  const organizationId = request.nextUrl.searchParams.get("organizationId") ?? undefined;

  try {
    const report = await importEstherRealData(prisma, {
      organizationId,
      organizationSlug: organizationId ? undefined : orgSlug,
    });

    return NextResponse.json({
      ok: true,
      summary: formatImportReport(report),
      report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
