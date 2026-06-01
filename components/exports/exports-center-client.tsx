"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Download, History, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionGate } from "@/components/shared/permission-gate";
import { EXPORT_SECTION_LABELS, DOCUMENT_EXPORT_LINKS } from "@/lib/export/export-registry";
import type { ExportDefinition } from "@/lib/export/export-types";
import type { SessionUser } from "@/lib/permissions";
import { requestExportAction } from "@/server/actions/export.actions";

type ExportWithMeta = ExportDefinition & {
  estimatedRows: number;
  lastCompletedAt: Date | null;
};

export function ExportsCenterClient({
  user,
  exports: exportList,
}: {
  user: SessionUser;
  exports: ExportWithMeta[];
}) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const sections = ["commercial", "suppliers", "accounting", "pilotage"] as const;

  async function handleExport(type: string, format: "CSV" | "JSON") {
    const key = `${type}-${format}`;
    setLoading(key);
    const result = await requestExportAction({
      type,
      format,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    setLoading(null);
    if (result.success) {
      const blob = new Blob([result.content], {
        type: result.mimeType,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export téléchargé (${result.rowCount} lignes)`);
    } else {
      toast.error(result.error ?? "Export impossible");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Exports</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Centralisez les exports de vos données.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/exports/history">
              <History className="mr-2 h-4 w-4" />
              Historique
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/documents">
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </Link>
          </Button>
        </div>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6 text-sm text-amber-900">
          <strong>Exports — vérifiez les données avant usage comptable</strong> générés à partir de données
          fictives.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtres globaux</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Du</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Au</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {sections.map((section) => {
        const items = exportList.filter((e) => e.section === section);
        if (items.length === 0) return null;
        return (
          <section key={section} className="space-y-4">
            <h2 className="text-lg font-semibold">{EXPORT_SECTION_LABELS[section]}</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <Card key={item.type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{item.label}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      ~{item.estimatedRows} lignes
                      {item.lastCompletedAt
                        ? ` — Dernier export : ${new Date(item.lastCompletedAt).toLocaleDateString("fr-FR")}`
                        : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <PermissionGate user={user} permission="EXPORTS_CREATE">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={loading === `${item.type}-CSV`}
                          onClick={() => handleExport(item.type, "CSV")}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          CSV
                        </Button>
                        {item.supportsJson ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loading === `${item.type}-JSON`}
                            onClick={() => handleExport(item.type, "JSON")}
                          >
                            JSON
                          </Button>
                        ) : null}
                      </PermissionGate>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Documents imprimables</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {DOCUMENT_EXPORT_LINKS.map((link) => (
            <Card key={link.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{link.label}</CardTitle>
                <CardDescription>{link.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" asChild>
                  <Link href={link.href}>Ouvrir le module</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
