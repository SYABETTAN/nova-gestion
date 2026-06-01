"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction } from "@/server/actions/auth.actions";

export function RegisterFormClient() {
  const [loading, setLoading] = useState(false);

  async function handleRegister(formData: FormData) {
    setLoading(true);
    try {
      const result = await registerAction(formData);
      if (result?.error) toast.error(result.error);
    } catch {
      // redirect throws
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Créer un compte</CardTitle>
        <CardDescription>
          Créez votre organisation et accédez à Nova Gestion en tant que propriétaire.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Création..." : "Créer mon espace"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--color-muted-foreground)]">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
