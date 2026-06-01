import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type RegisterClosedClientProps = {
  message: string;
};

export function RegisterClosedClient({ message }: RegisterClosedClientProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Inscription sur invitation</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Si vous avez reçu une invitation équipe, utilisez le lien dans l&apos;email pour
          rejoindre votre organisation.
        </p>
        <Button asChild className="w-full">
          <Link href="/login">Se connecter</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
