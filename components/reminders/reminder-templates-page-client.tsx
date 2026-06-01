"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import type { ReminderLevel } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/shared/permission-gate";
import { ReminderLevelBadge } from "@/components/reminders/reminder-badges";
import { TEMPLATE_VARIABLES } from "@/lib/reminder-templates";
import { REMINDER_LEVEL_LABELS } from "@/lib/reminder-utils";
import type { SessionUser } from "@/lib/permissions";
import {
  createReminderTemplateAction,
  disableReminderTemplateAction,
  updateReminderTemplateAction,
} from "@/server/actions/reminder-template.actions";

type Template = {
  id: string;
  name: string;
  level: ReminderLevel;
  subject: string;
  message: string;
  isDefault: boolean;
  isActive: boolean;
};

export function ReminderTemplatesPageClient({
  user,
  templates,
}: {
  user: SessionUser;
  templates: Template[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleSave(formData: FormData, id?: string) {
    const input = {
      name: String(formData.get("name")),
      level: String(formData.get("level")),
      subject: String(formData.get("subject")),
      message: String(formData.get("message")),
      isDefault: formData.get("isDefault") === "on",
      isActive: formData.get("isActive") !== "off",
    };
    const result = id
      ? await updateReminderTemplateAction(id, input)
      : await createReminderTemplateAction(input);
    if (result.success) {
      toast.success(id ? "Modèle mis à jour" : "Modèle créé");
      setEditing(null);
      setCreating(false);
      router.refresh();
    } else toast.error(result.error ?? "Erreur");
  }

  async function handleDisable(id: string) {
    if (!confirm("Désactiver ce modèle ?")) return;
    const result = await disableReminderTemplateAction(id);
    if (result.success) {
      toast.success("Modèle désactivé");
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Modèles de relance</h1>
          </div>
          <p className="text-[var(--color-muted-foreground)]">Gérez les modèles de messages de relance.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link href="/reminders">← Retour</Link></Button>
          <PermissionGate user={user} permission="REMINDER_TEMPLATES_UPDATE">
            <Button onClick={() => setCreating(true)}>Créer un modèle</Button>
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Variables disponibles</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {TEMPLATE_VARIABLES.map((v) => (
            <Badge key={v} variant="outline">{v}</Badge>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>{t.name}</CardTitle>
                <ReminderLevelBadge level={t.level} />
                {t.isDefault && <Badge>Par défaut</Badge>}
                {!t.isActive && <Badge variant="secondary">Inactif</Badge>}
              </div>
              <PermissionGate user={user} permission="REMINDER_TEMPLATES_UPDATE">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(t)}>Modifier</Button>
                  {t.isActive && <Button size="sm" variant="ghost" onClick={() => handleDisable(t.id)}>Désactiver</Button>}
                </div>
              </PermissionGate>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{t.subject}</p>
              <pre className="mt-2 whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{t.message}</pre>
            </CardContent>
          </Card>
        ))}
      </div>

      {(creating || editing) && (
        <Card>
          <CardHeader><CardTitle>{editing ? "Modifier le modèle" : "Nouveau modèle"}</CardTitle></CardHeader>
          <CardContent>
            <form action={(fd) => handleSave(fd, editing?.id)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Nom</Label><Input name="name" defaultValue={editing?.name} required /></div>
                <div className="space-y-2">
                  <Label>Niveau</Label>
                  <select name="level" defaultValue={editing?.level ?? "FRIENDLY"} className="flex h-10 w-full rounded-md border px-3 text-sm">
                    {Object.entries(REMINDER_LEVEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2"><Label>Objet</Label><Input name="subject" defaultValue={editing?.subject} required /></div>
              <div className="space-y-2"><Label>Message</Label><Textarea name="message" defaultValue={editing?.message} rows={10} required /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isDefault" defaultChecked={editing?.isDefault} /> Modèle par défaut pour ce niveau</label>
              <div className="flex gap-2">
                <Button type="submit">Enregistrer</Button>
                <Button type="button" variant="outline" onClick={() => { setCreating(false); setEditing(null); }}>Annuler</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
