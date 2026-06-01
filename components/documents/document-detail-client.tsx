"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Download, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  formatFileSize,
  getDocumentStatusLabel,
  getDocumentTypeLabel,
  getMimeTypeLabel,
} from "@/lib/documents/document-utils";
import { getDocumentApiPath } from "@/lib/files";
import type { SessionUser } from "@/lib/permissions";
import { archiveDocumentAction } from "@/server/actions/document.actions";
import type { Document } from "@prisma/client";

export function DocumentDetailClient({
  user,
  document,
}: {
  user: SessionUser;
  document: Document & { generatedBy: { name: string; email: string } | null };
}) {
  const router = useRouter();
  const downloadHref = getDocumentApiPath(document.id);

  async function handleArchive() {
    await archiveDocumentAction(document.id);
    toast.success("Document archivé");
    router.refresh();
  }

  const entityHref =
    document.entityType === "Invoice" && document.entityId
      ? `/invoices/${document.entityId}`
      : document.entityType === "Quote" && document.entityId
        ? `/quotes/${document.entityId}`
        : document.entityType === "Payment" && document.entityId
          ? `/payments/${document.entityId}`
          : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{document.title}</h1>
        <Badge variant="outline">{getDocumentStatusLabel(document.status)}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Métadonnées</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <span className="text-[var(--color-muted-foreground)]">Type :</span>{" "}
            {getDocumentTypeLabel(document.type)}
          </p>
          <p>
            <span className="text-[var(--color-muted-foreground)]">Fichier :</span>{" "}
            {document.fileName}
          </p>
          <p>
            <span className="text-[var(--color-muted-foreground)]">MIME :</span>{" "}
            {getMimeTypeLabel(document.mimeType)}
          </p>
          <p>
            <span className="text-[var(--color-muted-foreground)]">Taille :</span>{" "}
            {formatFileSize(document.sizeBytes)}
          </p>
          <p>
            <span className="text-[var(--color-muted-foreground)]">Généré par :</span>{" "}
            {document.generatedBy?.name ?? "—"}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {entityHref ? (
          <Button variant="outline" asChild>
            <Link href={entityHref}>Voir l&apos;entité liée</Link>
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link href={downloadHref} target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" />
            Télécharger
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimer
        </Button>
        <PermissionGate user={user} permission="DOCUMENTS_ARCHIVE">
          {document.status !== "ARCHIVED" ? (
            <Button variant="outline" onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              Archiver
            </Button>
          ) : null}
        </PermissionGate>
        <Button variant="ghost" asChild>
          <Link href="/documents">Retour</Link>
        </Button>
      </div>

      <p className="text-xs text-[var(--color-muted-foreground)]">
        Document généré par Nova Gestion.
      </p>
    </div>
  );
}
