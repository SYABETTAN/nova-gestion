"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import type { PaymentMethod } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { buildAutoAllocations } from "@/lib/payment-math";
import { money, moneyAdd, moneyToNumber, type MoneyInput } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-status";
import { formatCurrency } from "@/lib/pricing";
import { formatDateShort } from "@/lib/utils";
import {
  createPaymentAction,
  getOpenInvoicesForCustomerAction,
  updatePaymentAction,
} from "@/server/actions/payment.actions";

type CustomerOption = {
  id: string;
  name: string;
  outstandingAmount?: MoneyInput;
  currency?: string;
};

type OpenInvoice = {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  totalIncludingTax: MoneyInput;
  amountPaid: MoneyInput;
  amountDue: MoneyInput;
  currency: string;
};

type PaymentFormProps = {
  mode: "create" | "edit";
  customers: CustomerOption[];
  defaultPaymentDate?: string;
  disabled?: boolean;
  prefill?: {
    customerId?: string;
    invoiceId?: string;
    amount?: number;
    invoiceNumber?: string;
    customerName?: string;
    totalIncludingTax?: number;
    amountPaid?: number;
    amountDue?: number;
    currency?: string;
    returnInvoiceId?: string;
  };
  payment?: {
    id: string;
    customerId: string;
    paymentDate: Date;
    amount: MoneyInput;
    currency: string;
    method: PaymentMethod;
    reference: string | null;
    bankReference: string | null;
    checkNumber: string | null;
    cardLast4: string | null;
    notes: string | null;
    internalNotes: string | null;
    allocatedAmount: MoneyInput;
  };
};

export function PaymentForm({
  mode,
  customers,
  prefill,
  payment,
  defaultPaymentDate,
  disabled,
}: PaymentFormProps) {
  const router = useRouter();
  const hasInvoicePrefill = Boolean(mode === "create" && prefill?.invoiceId);
  const [customerId, setCustomerId] = useState(prefill?.customerId ?? payment?.customerId ?? "");
  const [paymentDate, setPaymentDate] = useState(
    payment?.paymentDate
      ? new Date(payment.paymentDate).toISOString().slice(0, 10)
      : (defaultPaymentDate ?? ""),
  );
  const [amount, setAmount] = useState(
    String(prefill?.amount ?? (payment?.amount != null ? moneyToNumber(payment.amount) : "")),
  );
  const [method, setMethod] = useState<PaymentMethod>(payment?.method ?? "BANK_TRANSFER");
  const [reference, setReference] = useState(payment?.reference ?? "");
  const [bankReference, setBankReference] = useState(payment?.bankReference ?? "");
  const [checkNumber, setCheckNumber] = useState(payment?.checkNumber ?? "");
  const [cardLast4, setCardLast4] = useState(payment?.cardLast4 ?? "");
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [internalNotes, setInternalNotes] = useState(payment?.internalNotes ?? "");
  const [autoAllocate, setAutoAllocate] = useState(mode === "create" && !hasInvoicePrefill);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([]);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [prefillApplied, setPrefillApplied] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const amountNum = moneyToNumber(money(amount || "0"));
  const currency = prefill?.currency ?? payment?.currency ?? selectedCustomer?.currency ?? "EUR";

  useEffect(() => {
    if (!customerId || mode === "edit") return;
    getOpenInvoicesForCustomerAction(customerId).then((invoices) => {
      setOpenInvoices(invoices);
      if (prefill?.invoiceId && !prefillApplied) {
        const inv = invoices.find((i) => i.id === prefill.invoiceId);
        if (inv) {
          setAllocations({ [inv.id]: String(moneyToNumber(inv.amountDue)) });
          setAutoAllocate(false);
          setAmount(String(moneyToNumber(inv.amountDue)));
          setPrefillApplied(true);
        }
      }
    });
  }, [customerId, mode, prefill?.invoiceId, prefillApplied]);

  const totalAllocated = useMemo(() => {
    return moneyToNumber(
      Object.values(allocations).reduce((s, v) => moneyAdd(s, v || "0"), money(0)),
    );
  }, [allocations]);

  const remainingToAllocate = Math.max(0, amountNum - totalAllocated);

  function handleAutoAllocateToggle(checked: boolean) {
    setAutoAllocate(checked);
    if (checked && amountNum > 0) {
      const auto = buildAutoAllocations(amountNum, openInvoices);
      const map: Record<string, string> = {};
      auto.forEach((a) => {
        map[a.invoiceId] = String(a.amount);
      });
      setAllocations(map);
    }
  }

  useEffect(() => {
    if (autoAllocate && amountNum > 0 && openInvoices.length > 0 && !hasInvoicePrefill) {
      const auto = buildAutoAllocations(amountNum, openInvoices);
      const map: Record<string, string> = {};
      auto.forEach((a) => {
        map[a.invoiceId] = String(a.amount);
      });
      setAllocations(map);
    }
  }, [amountNum, autoAllocate, openInvoices, hasInvoicePrefill]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setLoading(true);

    const allocationList = Object.entries(allocations)
      .filter(([, v]) => moneyToNumber(v || "0") > 0)
      .map(([invoiceId, v]) => ({ invoiceId, amount: moneyToNumber(v || "0") }));

    const payload = {
      customerId,
      paymentDate: new Date(paymentDate),
      amount: amountNum,
      currency,
      method,
      reference: reference || null,
      bankReference: bankReference || null,
      checkNumber: method === "CHECK" ? checkNumber || null : null,
      cardLast4: method === "CARD" ? cardLast4 || null : null,
      notes: notes || null,
      internalNotes: internalNotes || null,
      autoAllocate: false,
      allocations: autoAllocate ? [] : allocationList,
    };

    const result =
      mode === "create"
        ? await createPaymentAction({ ...payload, autoAllocate })
        : await updatePaymentAction(payment!.id, payload);

    setLoading(false);
    if (result.success) {
      toast.success(mode === "create" ? "Paiement enregistré" : "Paiement modifié");
      if (mode === "create" && prefill?.returnInvoiceId) {
        router.push(`/invoices/${prefill.returnInvoiceId}`);
      } else {
        const targetId = mode === "create" && "paymentId" in result ? result.paymentId : payment!.id;
        router.push(`/payments/${targetId}`);
      }
      router.refresh();
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasInvoicePrefill && prefill?.invoiceNumber && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6 text-sm">
            <p className="font-medium">
              Paiement pour la facture {prefill.invoiceNumber}
              {prefill.customerName ? ` — ${prefill.customerName}` : ""}
            </p>
            <div className="mt-2 grid gap-1 text-[var(--color-muted-foreground)] md:grid-cols-3">
              <p>Total TTC : {formatCurrency(prefill.totalIncludingTax ?? 0, currency)}</p>
              <p>Déjà payé : {formatCurrency(prefill.amountPaid ?? 0, currency)}</p>
              <p className="font-medium text-amber-700">
                Reste à payer : {formatCurrency(prefill.amountDue ?? prefill.amount ?? 0, currency)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Client</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={customerId} onValueChange={setCustomerId} disabled={mode === "edit" || disabled || hasInvoicePrefill}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedCustomer && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p>Encours client : {formatCurrency(selectedCustomer.outstandingAmount ?? 0, currency)}</p>
              <p className="text-[var(--color-muted-foreground)]">
                {openInvoices.length} facture(s) ouverte(s)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Paiement</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Date de paiement *</Label>
            <Input id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} required disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Montant *</Label>
            <Input id="amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label>Mode de paiement *</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference">Référence</Label>
            <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} disabled={disabled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankReference">Référence bancaire</Label>
            <Input id="bankReference" value={bankReference} onChange={(e) => setBankReference(e.target.value)} disabled={disabled} />
          </div>
          {method === "CHECK" && (
            <div className="space-y-2">
              <Label htmlFor="checkNumber">N° chèque</Label>
              <Input id="checkNumber" value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} disabled={disabled} />
            </div>
          )}
          {method === "CARD" && (
            <div className="space-y-2">
              <Label htmlFor="cardLast4">4 derniers chiffres</Label>
              <Input id="cardLast4" maxLength={4} value={cardLast4} onChange={(e) => setCardLast4(e.target.value)} disabled={disabled} />
            </div>
          )}
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={disabled} />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="internalNotes">Notes internes</Label>
            <Textarea id="internalNotes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} disabled={disabled} />
          </div>
        </CardContent>
      </Card>

      {mode === "create" && customerId && openInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasInvoicePrefill && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoAllocate}
                  onChange={(e) => handleAutoAllocateToggle(e.target.checked)}
                  disabled={disabled}
                />
                Allocation automatique (factures les plus anciennes en premier)
              </label>
            )}
            {(!autoAllocate || hasInvoicePrefill) && (
              <div className="space-y-3">
                {openInvoices.map((inv) => (
                  <div key={inv.id} className="flex flex-wrap items-center gap-4 rounded border p-3">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-mono font-medium">{inv.invoiceNumber}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        Échéance {formatDateShort(inv.dueDate)} — Reste {formatCurrency(inv.amountDue, inv.currency)}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max={moneyToNumber(inv.amountDue)}
                      step="0.01"
                      className="w-32"
                      placeholder="0,00"
                      value={allocations[inv.id] ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        setAllocations((prev) => ({ ...prev, [inv.id]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-sm font-medium">
              <span>Montant restant à allouer</span>
              <span className={remainingToAllocate > 0 ? "text-amber-600" : "text-emerald-600"}>
                {formatCurrency(remainingToAllocate, currency)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "create" && customerId && openInvoices.length === 0 && hasInvoicePrefill && (
        <Card>
          <CardContent className="pt-6 text-sm text-amber-700">
            La facture ciblée n&apos;est plus éligible au paiement ou le solde est nul.
          </CardContent>
        </Card>
      )}

      {mode === "edit" && payment && (
        <Card>
          <CardContent className="pt-6 text-sm text-[var(--color-muted-foreground)]">
            Montant déjà alloué : {formatCurrency(payment.allocatedAmount, payment.currency)} — Les allocations se gèrent depuis la fiche paiement.
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading || disabled}>
          {loading ? "Enregistrement..." : mode === "create" ? "Enregistrer le paiement" : "Sauvegarder"}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={prefill?.returnInvoiceId ? `/invoices/${prefill.returnInvoiceId}` : mode === "edit" ? `/payments/${payment!.id}` : "/payments"}>
            Annuler
          </Link>
        </Button>
      </div>
    </form>
  );
}
