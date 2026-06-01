"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { NumberingSequence } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PermissionGate } from "@/components/shared/permission-gate";
import { NUMBERING_TYPE_LABELS, RESET_PERIOD_LABELS } from "@/lib/app-labels";
import { formatNumberPreview } from "@/lib/numbering";
import type { SessionUser } from "@/lib/permissions";
import {
  generateNumberAction,
  updateNumberingSequenceAction,
} from "@/server/actions/numbering.actions";

type NumberingPageClientProps = {
  user: SessionUser;
  sequences: NumberingSequence[];
};

export function NumberingPageClient({ user, sequences }: NumberingPageClientProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Numérotation</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Configurez les séquences de numérotation automatique
        </p>
      </div>

      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Préfixe</TableHead>
              <TableHead>Prochain n°</TableHead>
              <TableHead>Padding</TableHead>
              <TableHead>Suffixe</TableHead>
              <TableHead>Réinitialisation</TableHead>
              <TableHead>Aperçu</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sequences.map((seq) => (
              <SequenceRow key={seq.id} sequence={seq} user={user} />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function SequenceRow({
  sequence,
  user,
}: {
  sequence: NumberingSequence;
  user: SessionUser;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [prefix, setPrefix] = useState(sequence.prefix);
  const [nextNumber, setNextNumber] = useState(sequence.nextNumber);
  const [padding, setPadding] = useState(sequence.padding);
  const [suffix, setSuffix] = useState(sequence.suffix);
  const [resetPeriod, setResetPeriod] = useState(sequence.resetPeriod);

  const preview = useMemo(
    () => formatNumberPreview({ prefix, nextNumber, padding, suffix, resetPeriod }),
    [prefix, nextNumber, padding, suffix, resetPeriod],
  );

  async function handleSave() {
    setLoading(true);
    const formData = new FormData();
    formData.set("id", sequence.id);
    formData.set("prefix", prefix);
    formData.set("nextNumber", String(nextNumber));
    formData.set("padding", String(padding));
    formData.set("suffix", suffix);
    formData.set("resetPeriod", resetPeriod);
    const result = await updateNumberingSequenceAction(formData);
    setLoading(false);
    if (result.success) {
      toast.success("Séquence mise à jour");
      setOpen(false);
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  async function handleGenerate() {
    const result = await generateNumberAction(sequence.type);
    if (result.success) {
      toast.success(`Numéro généré : ${result.number}`);
      setNextNumber((n) => n + 1);
    } else {
      toast.error("Erreur lors de la génération");
    }
  }

  return (
    <TableRow>
      <TableCell className="font-medium">
        {NUMBERING_TYPE_LABELS[sequence.type] ?? sequence.type}
      </TableCell>
      <TableCell>{sequence.prefix}</TableCell>
      <TableCell>{sequence.nextNumber}</TableCell>
      <TableCell>{sequence.padding}</TableCell>
      <TableCell>{sequence.suffix || "—"}</TableCell>
      <TableCell>
        <Badge variant="secondary">
          {RESET_PERIOD_LABELS[sequence.resetPeriod] ?? sequence.resetPeriod}
        </Badge>
      </TableCell>
      <TableCell>
        <code className="rounded bg-slate-100 px-2 py-1 text-xs">{preview}</code>
      </TableCell>
      <TableCell>
        <PermissionGate user={user} permission="NUMBERING_UPDATE">
          <div className="flex gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Modifier
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    Modifier — {NUMBERING_TYPE_LABELS[sequence.type]}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Préfixe</Label>
                    <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Prochain numéro</Label>
                      <Input
                        type="number"
                        value={nextNumber}
                        onChange={(e) => setNextNumber(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Padding</Label>
                      <Input
                        type="number"
                        value={padding}
                        onChange={(e) => setPadding(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Suffixe</Label>
                    <Input value={suffix} onChange={(e) => setSuffix(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Réinitialisation</Label>
                    <Select value={resetPeriod} onValueChange={(v) => setResetPeriod(v as typeof resetPeriod)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NEVER">Jamais</SelectItem>
                        <SelectItem value="YEARLY">Annuelle</SelectItem>
                        <SelectItem value="MONTHLY">Mensuelle</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-[var(--color-muted-foreground)]">Aperçu en direct</p>
                    <code className="text-sm font-medium">{preview}</code>
                  </div>
                  <Button onClick={handleSave} disabled={loading}>
                    {loading ? "Sauvegarde..." : "Sauvegarder"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={handleGenerate}>
              Générer
            </Button>
          </div>
        </PermissionGate>
      </TableCell>
    </TableRow>
  );
}
