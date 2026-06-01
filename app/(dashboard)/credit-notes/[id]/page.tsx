import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort } from "@/lib/utils";
import { getCreditNoteByIdAction } from "@/server/actions/credit-note.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function CreditNoteDetailPage({ params }: PageProps) {
  await requireAuth();
  const { id } = await params;
  const creditNote = await getCreditNoteByIdAction(id);
  if (!creditNote) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold font-mono">{creditNote.creditNoteNumber}</h1>
        <Badge variant="outline">{creditNote.status}</Badge>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/credit-notes/${creditNote.id}/print`}>Imprimer / PDF</Link>
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle>Avoir — {creditNote.reason}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Facture liée : <Link href={`/invoices/${creditNote.invoice.id}`} className="text-blue-600">{creditNote.invoice.invoiceNumber}</Link></p>
          <p>Client : {creditNote.customer.name}</p>
          <p>Date : {formatDateShort(creditNote.issueDate)}</p>
          <p className="text-lg font-bold">Total TTC : {formatCurrency(creditNote.totalIncludingTax)}</p>
          <div className="mt-4 space-y-2">
            {creditNote.lines.map((line) => (
              <div key={line.id} className="flex justify-between border-b py-2">
                <span>{line.name}</span>
                <span>{formatCurrency(line.totalIncludingTax)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Button variant="outline" asChild><Link href={`/invoices/${creditNote.invoice.id}`}>← Retour à la facture</Link></Button>
    </div>
  );
}
