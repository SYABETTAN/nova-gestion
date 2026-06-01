"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { devLoginAction, loginAction } from "@/server/actions/auth.actions";

const devLoginEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

type LoginPageClientProps = {
  publicSignupAllowed: boolean;
};

export function LoginPageClient({ publicSignupAllowed }: LoginPageClientProps) {
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);

  async function handleLogin(formData: FormData) {
    setLoading(true);
    try {
      const result = await loginAction(formData);
      if (result?.error) toast.error(result.error);
    } catch {
      // redirect throws
    } finally {
      setLoading(false);
    }
  }

  async function handleDevLogin() {
    setDevLoading(true);
    try {
      const result = await devLoginAction();
      if (result?.error) toast.error(result.error);
    } catch {
      // redirect throws
    } finally {
      setDevLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connexion à Nova Gestion</CardTitle>
          <CardDescription>Connectez-vous avec votre compte utilisateur.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="vous@entreprise.fr"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Connexion..." : "Connexion"}
            </Button>
          </form>

          {devLoginEnabled ? (
            <>
              <div className="my-4 flex items-center gap-4">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                <span className="text-xs text-[var(--color-muted-foreground)]">dev</span>
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={devLoading}
                onClick={handleDevLogin}
              >
                {devLoading ? "Connexion..." : "Connexion développeur (owner@dev.local)"}
              </Button>
            </>
          ) : null}

          {publicSignupAllowed ? (
            <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
              Pas de compte ?{" "}
              <Link href="/register" className="text-blue-600 hover:underline">
                Créer un espace
              </Link>
            </p>
          ) : (
            <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
              Les inscriptions sont disponibles sur invitation.{" "}
              <Link href="/register" className="text-blue-600 hover:underline">
                En savoir plus
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
