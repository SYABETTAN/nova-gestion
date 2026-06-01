"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/shared/permission-gate";
import { SettingsPageShell } from "@/components/settings/settings-page-shell";
import type { SessionUser } from "@/lib/permissions";

type Field =
  | { type: "text"; name: string; label: string }
  | { type: "number"; name: string; label: string }
  | { type: "textarea"; name: string; label: string }
  | { type: "checkbox"; name: string; label: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[] };

export function PreferencesFormClient({
  user,
  title,
  description,
  fields,
  values,
  onSave,
  warning,
}: {
  user: SessionUser;
  title: string;
  description: string;
  fields: Field[];
  values: Record<string, unknown>;
  onSave: (formData: FormData) => Promise<{ success: boolean }>;
  warning?: string;
}) {
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const result = await onSave(formData);
    if (result.success) {
      toast.success("Préférences enregistrées");
      router.refresh();
    }
  }

  return (
    <SettingsPageShell title={title} description={description}>
      {warning ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {warning}
        </p>
      ) : null}
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        {fields.map((field) => (
          <div key={field.name} className="space-y-1">
            {field.type === "checkbox" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={field.name}
                  defaultChecked={!!values[field.name]}
                  className="h-4 w-4 rounded border"
                />
                {field.label}
              </label>
            ) : (
              <>
                <Label>{field.label}</Label>
                {field.type === "textarea" ? (
                  <Textarea
                    name={field.name}
                    defaultValue={String(values[field.name] ?? "")}
                  />
                ) : field.type === "select" ? (
                  <select
                    name={field.name}
                    defaultValue={String(values[field.name] ?? "")}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    name={field.name}
                    type={field.type === "number" ? "number" : "text"}
                    defaultValue={String(values[field.name] ?? "")}
                  />
                )}
              </>
            )}
          </div>
        ))}
        <PermissionGate user={user} permission="ADVANCED_SETTINGS_UPDATE">
          <Button type="submit">Enregistrer</Button>
        </PermissionGate>
      </form>
    </SettingsPageShell>
  );
}
