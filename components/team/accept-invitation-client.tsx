"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvitationAction } from "@/server/actions/invitation.actions";
import type { InvitationPreviewResult } from "@/server/actions/invitation.actions";
import { formatDateShort } from "@/lib/utils";

type AcceptInvitationClientProps = {
  token: string;
  preview: InvitationPreviewResult;
};

export function AcceptInvitationClient({ token, preview }: AcceptInvitationClientProps) {
  const [loading, setLoading] = useState(false);

  if (!preview.valid) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Invitation indisponible</CardTitle>
          <CardDescription>{preview.error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function handleAccept(formData: FormData) {
    setLoading(true);
    formData.set("token", token);
    try {
      const result = await acceptInvitationAction(formData);
      if (result && !result.success) {
        toast.error(result.error ?? "Impossible d'accepter l'invitation");
      }
    } catch {
      // redirect on success
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Rejoindre {preview.organizationName}</CardTitle>
        <CardDescription>
          {preview.inviterName} vous invite en tant que {preview.roleName}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-1">
          <p>
            <strong>Email :</strong> {preview.email}
          </p>
          <p>
            <strong>Expire le :</strong> {formatDateShort(new Date(preview.expiresAt))}
          </p>
        </div>

        {preview.loggedIn && preview.emailMatchesSession ? (
          <form action={handleAccept} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connecté en tant que {preview.sessionEmail}. Confirmez pour rejoindre l&apos;organisation.
            </p>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Acceptation..." : "Accepter l'invitation"}
            </Button>
          </form>
        ) : (
          <form action={handleAccept} className="space-y-4">
            {preview.requiresName && (
              <div className="space-y-2">
                <Label htmlFor="name">Votre nom</Label>
                <Input id="name" name="name" required minLength={2} />
              </div>
            )}
            {preview.requiresPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">
                  {preview.requiresName ? "Mot de passe" : "Mot de passe de votre compte"}
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Acceptation..." : "Accepter l'invitation"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
