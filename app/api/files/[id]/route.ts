import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDocumentFileBuffer } from "@/lib/documents/document-storage";
import { hasPermission } from "@/lib/permissions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  if (!hasPermission(user, "DOCUMENTS_READ")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const { document, buffer } = await getDocumentFileBuffer(id, user.organizationId);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.fileName)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }
}
