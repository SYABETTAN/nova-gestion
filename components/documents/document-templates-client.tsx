"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { getDocumentTypeLabel } from "@/lib/documents/document-utils";
import type { SessionUser } from "@/lib/permissions";
import {
  disableDocumentTemplateAction,
  setDefaultDocumentTemplateAction,
} from "@/server/actions/document-template.actions";
import type { DocumentTemplate } from "@prisma/client";
import { PermissionGate } from "@/components/shared/permission-gate";

export function DocumentTemplatesClient({
  user,
  templates,
}: {
  user: SessionUser;
  templates: DocumentTemplate[];
}) {
  const router = useRouter();

  async function setDefault(id: string) {
    await setDefaultDocumentTemplateAction(id);
    toast.success("Modèle défini par défaut");
    router.refresh();
  }

  async function disable(id: string) {
    await disableDocumentTemplateAction(id);
    toast.success("Modèle désactivé");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Modèles de documents</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            En-têtes et pieds de page
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/documents">Bibliothèque</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Par défaut</TableHead>
            <TableHead>Actif</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((tpl) => (
            <TableRow key={tpl.id}>
              <TableCell className="font-medium">{tpl.name}</TableCell>
              <TableCell>{getDocumentTypeLabel(tpl.type)}</TableCell>
              <TableCell>{tpl.isDefault ? <Badge>Par défaut</Badge> : "—"}</TableCell>
              <TableCell>{tpl.isActive ? "Oui" : "Non"}</TableCell>
              <TableCell className="space-x-2">
                <PermissionGate user={user} permission="DOCUMENT_TEMPLATES_UPDATE">
                  {!tpl.isDefault && tpl.isActive ? (
                    <Button size="sm" variant="outline" onClick={() => setDefault(tpl.id)}>
                      Définir par défaut
                    </Button>
                  ) : null}
                  {tpl.isActive ? (
                    <Button size="sm" variant="ghost" onClick={() => disable(tpl.id)}>
                      Désactiver
                    </Button>
                  ) : null}
                </PermissionGate>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
