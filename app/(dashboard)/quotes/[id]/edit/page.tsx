import Link from "next/link";
import { notFound } from "next/navigation";
import { QuoteForm } from "@/components/quotes/quote-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { isQuoteEditable } from "@/lib/quote-status";
import { getQuoteByIdAction, getQuoteFormDataAction } from "@/server/actions/quote.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditQuotePage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;

  const [quote, formData] = await Promise.all([
    getQuoteByIdAction(id),
    getQuoteFormDataAction(),
  ]);

  if (!quote) notFound();

  if (!isQuoteEditable(quote.status)) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Modification impossible</h1>
        <p className="text-[var(--color-muted-foreground)]">
          Ce devis ne peut plus être modifié dans son statut actuel.
        </p>
        <Button asChild variant="outline">
          <Link href={`/quotes/${id}`}>Retour au devis</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Modifier le devis {quote.quoteNumber}</h1>
        </div>
      </div>
      <QuoteForm
        mode="edit"
        quote={quote}
        customers={formData.customers}
        items={formData.items}
        organization={formData.organization}
      />
    </div>
  );
}
