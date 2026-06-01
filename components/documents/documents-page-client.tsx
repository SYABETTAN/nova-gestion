"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDocumentStatusLabel,
  getDocumentTypeLabel,
  formatFileSize,
} from "@/lib/documents/document-utils";
import type { Document } from "@prisma/client";

export function DocumentsPageClient({
  documents,
}: {
  documents: (Document & { generatedBy: { name: string } | null })[];
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Bibliothèque documentaire</h1>
          </div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Documents générés et références fictives
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/documents/templates">Modèles de documents</Link>
        </Button>
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Aucun document généré pour le moment.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Fichier</TableHead>
              <TableHead>Généré le</TableHead>
              <TableHead>Taille</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.title}</TableCell>
                <TableCell>{getDocumentTypeLabel(doc.type)}</TableCell>
                <TableCell>{getDocumentStatusLabel(doc.status)}</TableCell>
                <TableCell className="font-mono text-xs">{doc.fileName}</TableCell>
                <TableCell>
                  {doc.generatedAt
                    ? new Date(doc.generatedAt).toLocaleDateString("fr-FR")
                    : "—"}
                </TableCell>
                <TableCell>{formatFileSize(doc.sizeBytes)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/documents/${doc.id}`}>Voir</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
