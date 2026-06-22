"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookCheck,
  Check,
  ChevronDown,
  Copy,
  Eye,
  FilePlus2,
  Mail,
  PiggyBank,
  Plus,
  Printer,
  Save,
  Trash2,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DiscountType, InvoiceLineType, InvoiceStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceCustomerSearch } from "@/components/invoices/invoice-customer-search";
import { InvoiceLineItemSearch } from "@/components/invoices/invoice-line-item-search";
import { QuickCreateCustomerDialog } from "@/components/invoices/quick-create-customer-dialog";
import { QuickCreateItemDialog } from "@/components/invoices/quick-create-item-dialog";
import type { CustomerSelectOption } from "@/components/shared/customer-search-select";
import type { ItemSelectOption } from "@/lib/items";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";
import { formatCurrency } from "@/lib/pricing";
import { INVOICE_STATUS_LABELS, canMarkPaid } from "@/lib/invoice-status";
import { hasPermission, type SessionUser } from "@/lib/permissions";
import { moneyToNumber, type MoneyInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  archiveInvoiceAction,
  createInvoiceAction,
  duplicateInvoiceAction,
  updateInvoiceAction,
} from "@/server/actions/invoice.actions";
import { validateInvoiceAction } from "@/server/actions/invoice-status.actions";
import { generateAccountingEntryFromCustomerInvoiceAction } from "@/server/actions/accounting-generator.actions";
import { getCustomerForInvoiceFormAction } from "@/server/actions/customer.actions";

type CustomerOption = {
  id: string;
  name: string;
  defaultPaymentTermsDays: number;
};

type OrgDefaults = {
  defaultCurrency: string;
  defaultLocale: string;
  defaultPaymentTermsDays: number;
  defaultInvoiceFooter: string | null;
};

type CustomerDetails = {
  id: string;
  name: string;
  legalName: string | null;
  displayName: string | null;
  customerNumber: string;
  email: string | null;
  phone: string | null;
  siret: string | null;
  vatNumber: string | null;
  defaultPaymentTermsDays: number;
  defaultVatRate: MoneyInput;
  addresses: {
    id: string;
    type: string;
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string;
    city: string;
    country: string;
    isDefault: boolean;
  }[];
};

type FormLine = {
  key: string;
  itemId: string | null;
  lineType: InvoiceLineType;
  reference: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceExcludingTax: number;
  discountValue: number;
  vatRate: number;
};

type InvoiceInput = {
  id: string;
  status: InvoiceStatus;
  invoiceNumber?: string;
  type: string;
  customerId: string;
  title: string;
  subject: string | null;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  language: string;
  paymentTermsDays: number;
  introductionText: string | null;
  footerText: string | null;
  internalNotes: string | null;
  customerNotes: string | null;
  globalDiscountType: DiscountType | null;
  globalDiscountValue: MoneyInput;
  shippingAmountExcludingTax: MoneyInput;
  otherFeesExcludingTax: MoneyInput;
  amountPaid: MoneyInput;
  lines: {
    itemId: string | null;
    lineType: InvoiceLineType;
    position: number;
    reference: string | null;
    name: string;
    description: string | null;
    quantity: MoneyInput;
    unit: string;
    unitPriceExcludingTax: MoneyInput;
    discountType: DiscountType | null;
    discountValue: MoneyInput;
    vatRate: MoneyInput;
  }[];
};

type Props = {
  mode: "create" | "edit";
  user: SessionUser;
  customers: CustomerOption[];
  organization: OrgDefaults | null;
  initialCustomerId?: string;
  invoice?: InvoiceInput;
};

let lineSeq = 0;
function makeLine(partial?: Partial<FormLine>): FormLine {
  lineSeq += 1;
  return {
    key: `l-${lineSeq}`,
    itemId: null,
    lineType: "FREE_TEXT",
    reference: "",
    name: "",
    description: "",
    quantity: 1,
    unit: "unité",
    unitPriceExcludingTax: 0,
    discountValue: 0,
    vatRate: 20,
    ...partial,
  };
}

function toDateInput(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

const TABS = [
  { key: "lines", label: "Lignes" },
  { key: "footer", label: "Pied" },
  { key: "third", label: "Infos tiers" },
  { key: "einvoice", label: "Facture électronique" },
  { key: "notes", label: "Observations" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={cn(
        "flex w-[64px] shrink-0 flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[11px] leading-tight transition-colors",
        disabled
          ? "cursor-not-allowed text-slate-300"
          : accent
            ? "text-emerald-700 hover:bg-emerald-50"
            : "text-slate-700 hover:bg-slate-100",
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-center">{label}</span>
    </button>
  );
}

export function InvoiceSageForm({ mode, user, customers, organization, initialCustomerId, invoice }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("lines");

  const initialCustId = invoice?.customerId ?? initialCustomerId ?? "";
  const [customerId, setCustomerId] = useState(initialCustId);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSelectOption | null>(() => {
    const c = customers.find((x) => x.id === initialCustId);
    return c ? { id: c.id, name: c.name, displayName: null, customerNumber: "", email: null, phone: null, siret: null } : null;
  });
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);

  const [type, setType] = useState(invoice?.type ?? "STANDARD");
  const [objet, setObjet] = useState(invoice?.title ?? "");
  const [affaire, setAffaire] = useState(invoice?.subject ?? "");
  const [issueDate, setIssueDate] = useState(invoice ? toDateInput(invoice.issueDate) : toDateInput(new Date()));
  const [dueDate, setDueDate] = useState(
    invoice ? toDateInput(invoice.dueDate) : toDateInput(new Date(Date.now() + 30 * 86400000)),
  );
  const [currency, setCurrency] = useState(invoice?.currency ?? organization?.defaultCurrency ?? "EUR");
  const language = invoice?.language ?? organization?.defaultLocale ?? "fr-FR";
  const [paymentTermsDays, setPaymentTermsDays] = useState(
    invoice?.paymentTermsDays ?? organization?.defaultPaymentTermsDays ?? 30,
  );
  const [paymentMethod, setPaymentMethod] = useState("VIREMENT");

  const [globalDiscountType, setGlobalDiscountType] = useState<DiscountType | "NONE">(
    invoice?.globalDiscountType ?? "NONE",
  );
  const [globalDiscountValue, setGlobalDiscountValue] = useState(moneyToNumber(invoice?.globalDiscountValue ?? 0));
  const [port, setPort] = useState(moneyToNumber(invoice?.shippingAmountExcludingTax ?? 0));
  const [otherFees, setOtherFees] = useState(moneyToNumber(invoice?.otherFeesExcludingTax ?? 0));
  const [amountPaid, setAmountPaid] = useState(moneyToNumber(invoice?.amountPaid ?? 0));
  const [escompteRate, setEscompteRate] = useState(0);

  const [introduction, setIntroduction] = useState(invoice?.introductionText ?? "");
  const [customerNotes, setCustomerNotes] = useState(invoice?.customerNotes ?? "");
  const [footerText, setFooterText] = useState(invoice?.footerText ?? organization?.defaultInvoiceFooter ?? "");
  const [internalNotes, setInternalNotes] = useState(invoice?.internalNotes ?? "");

  const [lines, setLines] = useState<FormLine[]>(() =>
    invoice && invoice.lines.length > 0
      ? invoice.lines
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((l) =>
            makeLine({
              itemId: l.itemId,
              lineType: l.lineType,
              reference: l.reference ?? "",
              name: l.name,
              description: l.description ?? "",
              quantity: moneyToNumber(l.quantity),
              unit: l.unit,
              unitPriceExcludingTax: moneyToNumber(l.unitPriceExcludingTax),
              discountValue: moneyToNumber(l.discountValue),
              vatRate: moneyToNumber(l.vatRate),
            }),
          )
      : [makeLine({ name: "", unitPriceExcludingTax: 0 })],
  );
  const [selectedLine, setSelectedLine] = useState(0);

  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerDialogQuery, setCustomerDialogQuery] = useState("");
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemDialogQuery, setItemDialogQuery] = useState("");
  const [itemDialogLineIndex, setItemDialogLineIndex] = useState<number | null>(null);

  // Permissions
  const canSave = mode === "create" ? hasPermission(user, "INVOICES_CREATE") : hasPermission(user, "INVOICES_UPDATE");
  const canValidate = hasPermission(user, "INVOICES_VALIDATE");
  const canCancel = hasPermission(user, "INVOICES_CANCEL");
  const canPay = hasPermission(user, "PAYMENTS_CREATE");
  const canAccount = hasPermission(user, "ACCOUNTING_CREATE");
  const canCreate = hasPermission(user, "INVOICES_CREATE");

  const isSaved = mode === "edit" && Boolean(invoice?.id);
  const status: InvoiceStatus = invoice?.status ?? "DRAFT";

  // Charger les détails complets du client sélectionné
  useEffect(() => {
    if (!customerId) {
      setCustomerDetails(null);
      return;
    }
    let cancelled = false;
    getCustomerForInvoiceFormAction(customerId).then((c) => {
      if (cancelled || !c) return;
      setCustomerDetails(c as CustomerDetails);
      setSelectedCustomer({
        id: c.id,
        name: c.name,
        displayName: c.displayName,
        customerNumber: c.customerNumber,
        email: c.email,
        phone: c.phone,
        siret: c.siret,
      });
      if (mode === "create") {
        setPaymentTermsDays(c.defaultPaymentTermsDays);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [customerId, mode]);

  // Avertissement avant fermeture si modifications non enregistrées
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const totals = useMemo(
    () =>
      calculateInvoiceTotals({
        lines: lines.map((l) => ({
          lineType: l.lineType,
          quantity: l.quantity,
          unitPriceExcludingTax: l.unitPriceExcludingTax,
          discountType: l.discountValue > 0 ? "PERCENTAGE" : null,
          discountValue: l.discountValue,
          vatRate: l.vatRate,
        })),
        globalDiscountType: globalDiscountType === "NONE" ? null : globalDiscountType,
        globalDiscountValue,
        shippingAmountExcludingTax: port,
        otherFeesExcludingTax: otherFees,
        amountPaid,
      }),
    [lines, globalDiscountType, globalDiscountValue, port, otherFees, amountPaid],
  );

  const escompteAmount = useMemo(
    () => (escompteRate > 0 ? Math.round(totals.totalIncludingTax * escompteRate) / 100 : 0),
    [escompteRate, totals.totalIncludingTax],
  );

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function updateLine(index: number, patch: Partial<FormLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
    markDirty();
  }

  function applyItemToLine(index: number, item: ItemSelectOption) {
    updateLine(index, {
      itemId: item.id,
      lineType: item.type === "SERVICE" ? "SERVICE" : "ITEM",
      reference: item.itemNumber,
      name: item.name,
      description: item.shortDescription ?? item.description ?? "",
      unitPriceExcludingTax: item.salePriceExcludingTax,
      vatRate: item.defaultVatRate,
      unit: item.unitSymbol ?? "unité",
    });
  }

  function addLine() {
    setLines((prev) => [...prev, makeLine()]);
    setSelectedLine(lines.length);
    markDirty();
  }
  function insertLine() {
    setLines((prev) => {
      const next = prev.slice();
      next.splice(selectedLine, 0, makeLine());
      return next;
    });
    markDirty();
  }
  function deleteLine() {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== selectedLine)));
    setSelectedLine((i) => Math.max(0, i - 1));
    markDirty();
  }
  function duplicateLine() {
    setLines((prev) => {
      const src = prev[selectedLine];
      if (!src) return prev;
      const next = prev.slice();
      next.splice(selectedLine + 1, 0, makeLine({ ...src, key: undefined }));
      return next;
    });
    markDirty();
  }
  function addComment() {
    setLines((prev) => [...prev, makeLine({ lineType: "COMMENT", name: "Commentaire", unitPriceExcludingTax: 0 })]);
    markDirty();
  }

  function handleCustomerSelected(option: CustomerSelectOption) {
    setSelectedCustomer(option);
    setCustomerId(option.id);
    markDirty();
  }

  async function buildAndSubmit(): Promise<string | null> {
    if (!customerId) {
      toast.error("Sélectionnez un client");
      return null;
    }
    const cleanedLines = lines
      .filter(
        (l) =>
          l.name.trim() !== "" ||
          l.itemId ||
          l.unitPriceExcludingTax > 0 ||
          l.lineType === "COMMENT" ||
          l.lineType === "SECTION",
      )
      .map((l, i) => ({
        itemId: l.itemId,
        lineType: l.lineType,
        position: i,
        reference: l.reference || null,
        name: l.name.trim() || l.reference || "Ligne",
        description: l.description || null,
        quantity: l.quantity,
        unit: l.unit,
        unitPriceExcludingTax: l.unitPriceExcludingTax,
        discountType: l.discountValue > 0 ? "PERCENTAGE" : null,
        discountValue: l.discountValue,
        vatRate: l.vatRate,
      }));

    if (cleanedLines.filter((l) => l.lineType !== "COMMENT" && l.lineType !== "SECTION").length === 0) {
      toast.error("Ajoutez au moins une ligne facturable");
      return null;
    }

    const fd = new FormData();
    fd.set("customerId", customerId);
    fd.set("customerContactId", "");
    fd.set("billingAddressId", "");
    fd.set("shippingAddressId", "");
    fd.set("type", type);
    fd.set("title", objet.trim() || `Facture ${selectedCustomer?.name ?? ""}`.trim());
    fd.set("subject", affaire);
    fd.set("issueDate", issueDate);
    fd.set("dueDate", dueDate);
    fd.set("currency", currency);
    fd.set("language", language);
    fd.set("paymentTermsDays", String(paymentTermsDays));
    fd.set("globalDiscountType", globalDiscountType === "NONE" ? "" : globalDiscountType);
    fd.set("globalDiscountValue", String(globalDiscountValue));
    fd.set("shippingAmountExcludingTax", String(port));
    fd.set("otherFeesExcludingTax", String(otherFees));
    fd.set("amountPaid", String(amountPaid));
    fd.set("introductionText", introduction);
    fd.set("customerNotes", customerNotes);
    fd.set("footerText", footerText);
    fd.set("internalNotes", internalNotes);
    fd.set("lines", JSON.stringify(cleanedLines));

    setLoading(true);
    const result = mode === "create" ? await createInvoiceAction(fd) : await updateInvoiceAction(invoice!.id, fd);
    setLoading(false);

    if (result.success && result.invoiceId) {
      setDirty(false);
      return result.invoiceId;
    }
    toast.error(result.error ?? "Erreur lors de l'enregistrement");
    return null;
  }

  async function handleSave() {
    const id = await buildAndSubmit();
    if (id) {
      toast.success(mode === "create" ? "Facture créée" : "Facture enregistrée");
      router.push(`/invoices/${id}`);
      router.refresh();
    }
  }

  function handleClose() {
    if (dirty && !window.confirm("Des modifications ne sont pas enregistrées. Quitter sans enregistrer ?")) {
      return;
    }
    router.push(isSaved ? `/invoices/${invoice!.id}` : "/invoices");
  }

  async function runServer(fn: () => Promise<{ success: boolean; error?: string; message?: string }>, ok: string) {
    const r = await fn();
    if (r.success) {
      toast.success(r.message ?? ok);
      router.refresh();
    } else {
      toast.error(r.error ?? "Action impossible");
    }
  }

  const billableCount = lines.filter(
    (l) => l.lineType !== "COMMENT" && l.lineType !== "SECTION",
  ).length;

  function formatMoney(v: number) {
    return formatCurrency(v, currency);
  }

  const defaultAddress =
    customerDetails?.addresses.find((a) => a.isDefault) ?? customerDetails?.addresses[0] ?? null;

  return (
    <div className="flex flex-col gap-3 pb-10">
      {/* En-tête + statut */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {mode === "create" ? "Nouvelle facture" : `Facture ${invoice?.invoiceNumber ?? ""}`}
          </h1>
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-semibold",
              status === "DRAFT"
                ? "bg-blue-100 text-blue-800"
                : status === "PAID"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-sky-100 text-sky-800",
            )}
          >
            {mode === "create" ? "Brouillon" : INVOICE_STATUS_LABELS[status]}
          </span>
          {dirty && <span className="text-xs text-amber-600">• non enregistré</span>}
        </div>
      </div>

      {/* 1. Barre d'actions supérieure */}
      <div className="flex flex-wrap items-stretch gap-0.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
        <ToolbarButton icon={FilePlus2} label="Créer" disabled={!canCreate} onClick={() => router.push("/invoices/new")} />
        <ToolbarButton
          icon={Trash2}
          label="Supprimer"
          disabled={!isSaved || !canCancel}
          title={isSaved ? "Archiver la facture" : "Enregistrez d'abord"}
          onClick={() =>
            isSaved &&
            window.confirm("Archiver cette facture ?") &&
            runServer(() => archiveInvoiceAction(invoice!.id), "Facture archivée")
          }
        />
        <ToolbarButton
          icon={Eye}
          label="Aperçu"
          disabled={!isSaved}
          title={isSaved ? "Voir la facture" : "Enregistrez d'abord"}
          onClick={() => isSaved && router.push(`/invoices/${invoice!.id}`)}
        />
        <ToolbarButton
          icon={Printer}
          label="Imprimer"
          disabled={!isSaved}
          title={isSaved ? "Imprimer / PDF" : "Enregistrez d'abord"}
          onClick={() => isSaved && window.open(`/invoices/${invoice!.id}/print`, "_blank")}
        />
        <ToolbarButton
          icon={Mail}
          label="Email"
          disabled={!isSaved || status === "DRAFT"}
          title={status === "DRAFT" ? "Validez la facture avant l'envoi" : "Envoyer par email"}
          onClick={() => isSaved && router.push(`/invoices/${invoice!.id}`)}
        />
        <ToolbarButton icon={ArrowLeft} label="Précéd." disabled title="Fonction bientôt disponible" />
        <ToolbarButton icon={ArrowRight} label="Suivant" disabled title="Fonction bientôt disponible" />
        <ToolbarButton
          icon={Check}
          label="Valider"
          disabled={!isSaved || status !== "DRAFT" || !canValidate}
          title={!isSaved ? "Enregistrez d'abord" : status !== "DRAFT" ? "Déjà validée" : "Valider la facture"}
          onClick={() => isSaved && runServer(() => validateInvoiceAction(invoice!.id), "Facture validée")}
        />
        <ToolbarButton icon={PiggyBank} label="Acompte" disabled title="Fonction bientôt disponible" />
        <ToolbarButton
          icon={Wallet}
          label="Régler"
          disabled={!isSaved || !canMarkPaid(status) || !canPay}
          title={!isSaved ? "Enregistrez d'abord" : "Enregistrer un règlement"}
          onClick={() => isSaved && router.push(`/payments/new?invoiceId=${invoice!.id}`)}
        />
        <ToolbarButton
          icon={Undo2}
          label="Avoir"
          disabled={!isSaved}
          title={isSaved ? "Transférer en avoir (depuis la facture)" : "Enregistrez d'abord"}
          onClick={() => isSaved && router.push(`/invoices/${invoice!.id}`)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-[64px] shrink-0 flex-col items-center gap-1 rounded-md px-1 py-1.5 text-[11px] leading-tight text-slate-700 hover:bg-slate-100"
            >
              <ChevronDown className="h-5 w-5" />
              <span>Options</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              disabled={!isSaved || !canCreate}
              onClick={() => isSaved && runServer(() => duplicateInvoiceAction(invoice!.id), "Facture dupliquée")}
            >
              <Copy className="mr-2 h-4 w-4" />
              Dupliquer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Transférer (bientôt)</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ToolbarButton
          icon={BookCheck}
          label="Écriture"
          disabled={!isSaved || status === "DRAFT" || !canAccount}
          title={!isSaved ? "Enregistrez d'abord" : "Générer l'écriture comptable"}
          onClick={() =>
            isSaved &&
            runServer(
              () => generateAccountingEntryFromCustomerInvoiceAction(invoice!.id),
              "Écriture comptable générée",
            )
          }
        />
        <ToolbarButton
          icon={Eye}
          label="Ouvrir fact."
          disabled={!isSaved}
          onClick={() => isSaved && router.push(`/invoices/${invoice!.id}`)}
        />
        <ToolbarButton icon={Wallet} label="Fact. encaiss." disabled title="Fonction bientôt disponible" />
        <ToolbarButton icon={Save} label="OK" accent disabled={!canSave || loading} onClick={handleSave} />
        <ToolbarButton icon={X} label="Fermer" onClick={handleClose} />
      </div>

      {/* 2. Informations pièce + client */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Informations pièce
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Numéro">
              <Input
                value={invoice?.invoiceNumber ?? "Attribué à l'enregistrement"}
                readOnly
                className="h-9 bg-slate-50 font-mono text-slate-600"
              />
            </Field>
            <Field label="Type">
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  markDirty();
                }}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
              >
                <option value="STANDARD">Standard</option>
                <option value="DEPOSIT">Acompte</option>
                <option value="FINAL">Finale</option>
              </select>
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => {
                  setIssueDate(e.target.value);
                  markDirty();
                }}
                className="h-9"
              />
            </Field>
            <Field label="Date échéance">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  markDirty();
                }}
                className="h-9"
              />
            </Field>
            <Field label="Mode de règlement (indicatif)">
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                title="Indicatif — le délai de paiement ci-contre est enregistré"
              >
                <option value="CB">Carte bancaire</option>
                <option value="VIREMENT">Virement</option>
                <option value="CHEQUE">Chèque</option>
                <option value="ESPECES">Espèces</option>
              </select>
            </Field>
            <Field label="Délai paiement (jours)">
              <Input
                type="number"
                min={0}
                max={120}
                value={paymentTermsDays}
                onChange={(e) => {
                  setPaymentTermsDays(Number(e.target.value));
                  markDirty();
                }}
                className="h-9"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Informations client
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Client *">
                <InvoiceCustomerSearch
                  selected={selectedCustomer}
                  onSelect={handleCustomerSelected}
                  onRequestCreate={(q) => {
                    setCustomerDialogQuery(q);
                    setCustomerDialogOpen(true);
                  }}
                  disabled={mode === "edit" && status !== "DRAFT"}
                />
              </Field>
            </div>
            <Field label="Nom">
              <Input value={customerDetails?.name ?? selectedCustomer?.name ?? ""} readOnly className="h-9 bg-slate-50" />
            </Field>
            <Field label="Code client">
              <Input value={customerDetails?.customerNumber ?? ""} readOnly className="h-9 bg-slate-50 font-mono" />
            </Field>
            <Field label="Affaire / Référence">
              <Input
                value={affaire}
                onChange={(e) => {
                  setAffaire(e.target.value);
                  markDirty();
                }}
                className="h-9"
                placeholder="Référence interne"
              />
            </Field>
            <Field label="Représentant">
              <Input value={user.name} readOnly className="h-9 bg-slate-50" />
            </Field>
            <div className="col-span-2">
              <Field label="Objet *">
                <Input
                  value={objet}
                  onChange={(e) => {
                    setObjet(e.target.value);
                    markDirty();
                  }}
                  className="h-9"
                  placeholder="Objet de la facture"
                />
              </Field>
            </div>
            {defaultAddress && (
              <div className="col-span-2 text-xs text-slate-500">
                {defaultAddress.addressLine1}, {defaultAddress.postalCode} {defaultAddress.city} (
                {defaultAddress.country})
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Onglet Lignes */}
      <div hidden={activeTab !== "lines"} className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <LineActionButton icon={Plus} label="Ajouter" onClick={addLine} />
          <LineActionButton icon={ArrowRight} label="Insérer" onClick={insertLine} />
          <LineActionButton icon={Trash2} label="Supprimer" onClick={deleteLine} disabled={lines.length <= 1} />
          <LineActionButton icon={Copy} label="Dupliquer" onClick={duplicateLine} />
          <LineActionButton icon={Mail} label="Commentaire" onClick={addComment} />
          <LineActionButton icon={Plus} label="Sous-total" disabled title="Bientôt disponible" />
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                <th className="w-8 px-2 py-2 text-right">#</th>
                <th className="px-2 py-2 text-left" style={{ minWidth: 200 }}>Article</th>
                <th className="px-2 py-2 text-left" style={{ minWidth: 180 }}>Description</th>
                <th className="w-16 px-2 py-2 text-right">Qté</th>
                <th className="w-24 px-2 py-2 text-right">P.U. HT</th>
                <th className="w-24 px-2 py-2 text-right">P.U. TTC</th>
                <th className="w-16 px-2 py-2 text-right">Tx Rem.</th>
                <th className="w-24 px-2 py-2 text-right">Rem. HT</th>
                <th className="w-24 px-2 py-2 text-right">Rem. TTC</th>
                <th className="w-28 px-2 py-2 text-right">Total HT</th>
                <th className="w-28 px-2 py-2 text-right">Total TTC</th>
                <th className="w-16 px-2 py-2 text-right">TVA</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => {
                const calc = totals.lines[index];
                const isComment = line.lineType === "COMMENT" || line.lineType === "SECTION";
                const puTtc = line.unitPriceExcludingTax * (1 + line.vatRate / 100);
                const remTtc = (calc?.discountAmount ?? 0) * (1 + line.vatRate / 100);
                const selected = index === selectedLine;
                return (
                  <tr
                    key={line.key}
                    onClick={() => setSelectedLine(index)}
                    className={cn(
                      "border-b border-slate-100",
                      selected ? "bg-emerald-50/50" : index % 2 ? "bg-slate-50/40" : "bg-white",
                    )}
                  >
                    <td className="px-2 py-1 text-right text-slate-400">{index + 1}</td>
                    <td className="px-1 py-1">
                      <InvoiceLineItemSearch
                        value={line.name}
                        itemId={line.itemId}
                        onTextChange={(text) => updateLine(index, { name: text, itemId: null })}
                        onSelect={(item) => applyItemToLine(index, item)}
                        onRequestCreate={(q) => {
                          setItemDialogQuery(q);
                          setItemDialogLineIndex(index);
                          setItemDialogOpen(true);
                        }}
                      />
                    </td>
                    <td className="px-1 py-1">
                      <input
                        value={line.description}
                        onChange={(e) => updateLine(index, { description: e.target.value })}
                        className="h-7 w-full rounded border border-transparent bg-transparent px-1 text-[12px] hover:border-slate-200 focus:border-emerald-400 focus:bg-white focus:outline-none"
                        placeholder="Description"
                      />
                    </td>
                    {isComment ? (
                      <td colSpan={9} className="px-2 py-1 text-[11px] italic text-slate-400">
                        Ligne {line.lineType === "COMMENT" ? "commentaire" : "section"} (non facturée)
                      </td>
                    ) : (
                      <>
                        <td className="px-1 py-1">
                          <NumCell
                            value={line.quantity}
                            min={0}
                            onChange={(v) => updateLine(index, { quantity: v })}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <NumCell
                            value={line.unitPriceExcludingTax}
                            min={0}
                            onChange={(v) => updateLine(index, { unitPriceExcludingTax: v })}
                          />
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-slate-500">{puTtc.toFixed(2)}</td>
                        <td className="px-1 py-1">
                          <NumCell
                            value={line.discountValue}
                            min={0}
                            max={100}
                            onChange={(v) => updateLine(index, { discountValue: v })}
                          />
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-amber-700">
                          {(calc?.discountAmount ?? 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-amber-700">{remTtc.toFixed(2)}</td>
                        <td className="px-2 py-1 text-right font-medium tabular-nums text-slate-800">
                          {(calc?.totalExcludingTax ?? 0).toFixed(2)}
                        </td>
                        <td className="px-2 py-1 text-right font-medium tabular-nums text-slate-900">
                          {(calc?.totalIncludingTax ?? 0).toFixed(2)}
                        </td>
                        <td className="px-1 py-1">
                          <NumCell
                            value={line.vatRate}
                            min={0}
                            max={100}
                            onChange={(v) => updateLine(index, { vatRate: v })}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          {billableCount} ligne(s) facturable(s) — cliquez une ligne pour la sélectionner (Insérer/Supprimer/Dupliquer).
        </p>
      </div>

      {/* Onglet Pied */}
      <div hidden={activeTab !== "footer"} className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Remise globale</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select
                  value={globalDiscountType}
                  onChange={(e) => {
                    setGlobalDiscountType(e.target.value as DiscountType | "NONE");
                    markDirty();
                  }}
                  className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                >
                  <option value="NONE">Aucune</option>
                  <option value="PERCENTAGE">Pourcentage (%)</option>
                  <option value="FIXED_AMOUNT">Montant fixe</option>
                </select>
              </Field>
              <Field label="Valeur">
                <NumberInput value={globalDiscountValue} onChange={(v) => { setGlobalDiscountValue(v); markDirty(); }} />
              </Field>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Port &amp; frais</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Port HT (soumis TVA)">
                <NumberInput value={port} onChange={(v) => { setPort(v); markDirty(); }} />
              </Field>
              <Field label="Autres frais HT">
                <NumberInput value={otherFees} onChange={(v) => { setOtherFees(v); markDirty(); }} />
              </Field>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Escompte &amp; acompte</h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Taux escompte % (indicatif)">
                <NumberInput value={escompteRate} onChange={(v) => setEscompteRate(v)} />
              </Field>
              <Field label="Acompte / déjà réglé">
                <NumberInput value={amountPaid} onChange={(v) => { setAmountPaid(v); markDirty(); }} />
              </Field>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Totaux</h3>
          <TotalRow label="Brut HT" value={formatMoney(totals.subtotalExcludingTax)} />
          {totals.lineDiscountAmount > 0 && (
            <TotalRow label="Total remise lignes" value={`- ${formatMoney(totals.lineDiscountAmount)}`} amber />
          )}
          {totals.globalDiscountAmount > 0 && (
            <TotalRow label="Remise globale" value={`- ${formatMoney(totals.globalDiscountAmount)}`} amber />
          )}
          {port > 0 && <TotalRow label="Port HT" value={formatMoney(port)} />}
          {otherFees > 0 && <TotalRow label="Autres frais HT" value={formatMoney(otherFees)} />}
          <TotalRow label="Total HT" value={formatMoney(totals.totalExcludingTax)} bold />
          <TotalRow label="Total TVA" value={formatMoney(totals.totalVatAmount)} />
          <TotalRow label="Total TTC" value={formatMoney(totals.totalIncludingTax)} bold big />
          {escompteAmount > 0 && (
            <TotalRow label={`Escompte ${escompteRate}% (indicatif)`} value={`- ${formatMoney(escompteAmount)}`} amber />
          )}
          {amountPaid > 0 && <TotalRow label="Acompte / déjà réglé" value={`- ${formatMoney(amountPaid)}`} green />}
          <div className="mt-1 border-t pt-2">
            <TotalRow
              label="Net à payer / Solde dû"
              value={formatMoney(Math.max(0, totals.amountDue - escompteAmount))}
              bold
              big
            />
          </div>
        </div>
      </div>

      {/* Onglet Infos tiers */}
      <div hidden={activeTab !== "third"} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {customerDetails ? (
          <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <Info label="Code client" value={customerDetails.customerNumber} mono />
            <Info label="Société" value={customerDetails.legalName ?? customerDetails.name} />
            <Info label="Nom" value={customerDetails.name} />
            <Info label="Email" value={customerDetails.email} />
            <Info label="Téléphone" value={customerDetails.phone} />
            <Info label="SIRET" value={customerDetails.siret} />
            <Info label="TVA intracom." value={customerDetails.vatNumber} />
            <Info label="Conditions de paiement" value={`${customerDetails.defaultPaymentTermsDays} jours`} />
            <Info
              label="Adresse"
              value={
                defaultAddress
                  ? `${defaultAddress.addressLine1}${defaultAddress.addressLine2 ? `, ${defaultAddress.addressLine2}` : ""}, ${defaultAddress.postalCode} ${defaultAddress.city}`
                  : null
              }
            />
            <Info label="Pays" value={defaultAddress?.country ?? null} />
          </div>
        ) : (
          <p className="text-sm text-slate-400">Sélectionnez un client pour afficher ses informations.</p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Informations en lecture seule — modifiez la fiche client pour les mettre à jour.
        </p>
      </div>

      {/* Onglet Facture électronique */}
      <div hidden={activeTab !== "einvoice"} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Info label="Statut" value="Non activée" />
          <Info label="Mode d'envoi" value="—" />
          <Info label="Identifiant client (PDP)" value={customerDetails?.siret ?? "—"} />
        </div>
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Configuration facture électronique non activée. Aucune transmission n&apos;est effectuée pour le moment.
        </div>
      </div>

      {/* Onglet Observations */}
      <div hidden={activeTab !== "notes"} className="grid gap-3 lg:grid-cols-2">
        <Field label="Remarque interne">
          <Textarea value={internalNotes} onChange={(e) => { setInternalNotes(e.target.value); markDirty(); }} rows={4} />
        </Field>
        <Field label="Commentaire visible client">
          <Textarea value={customerNotes} onChange={(e) => { setCustomerNotes(e.target.value); markDirty(); }} rows={4} />
        </Field>
        <Field label="Conditions particulières (introduction)">
          <Textarea value={introduction} onChange={(e) => { setIntroduction(e.target.value); markDirty(); }} rows={4} />
        </Field>
        <Field label="Pied de facture">
          <Textarea value={footerText} onChange={(e) => { setFooterText(e.target.value); markDirty(); }} rows={4} />
        </Field>
      </div>

      {/* Pied de page d'action */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
        <Button variant="outline" onClick={handleClose}>
          Fermer
        </Button>
        <Button onClick={handleSave} disabled={!canSave || loading} className="bg-emerald-600 hover:bg-emerald-700">
          <Save className="mr-1.5 h-4 w-4" />
          {loading ? "Enregistrement…" : mode === "create" ? "Créer la facture" : "Enregistrer"}
        </Button>
      </div>

      <QuickCreateCustomerDialog
        open={customerDialogOpen}
        onOpenChange={setCustomerDialogOpen}
        initialName={customerDialogQuery}
        onCreated={(c) => handleCustomerSelected(c)}
      />
      <QuickCreateItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        initialName={itemDialogQuery}
        onCreated={(item) => {
          if (itemDialogLineIndex !== null) applyItemToLine(itemDialogLineIndex, item);
        }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
      <span className="text-slate-500">{label}</span>
      <span className={cn("text-right text-slate-800", mono && "font-mono")}>{value || "—"}</span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  bold,
  big,
  amber,
  green,
}: {
  label: string;
  value: string;
  bold?: boolean;
  big?: boolean;
  amber?: boolean;
  green?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between py-1 text-sm",
        bold && "font-semibold",
        big && "text-base",
        amber && "text-amber-700",
        green && "text-emerald-700",
      )}
    >
      <span className={cn(!amber && !green && "text-slate-600")}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function LineActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      className={cn(
        "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
        disabled
          ? "cursor-not-allowed border-slate-100 text-slate-300"
          : "border-slate-200 text-slate-700 hover:bg-slate-50",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function NumCell({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={0.01}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className="h-7 w-full rounded border border-transparent bg-transparent px-1 text-right text-[12px] tabular-nums hover:border-slate-200 focus:border-emerald-400 focus:bg-white focus:outline-none"
    />
  );
}

function NumberInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Input
      type="number"
      min={0}
      step={0.01}
      value={value}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className="h-9 text-right tabular-nums"
    />
  );
}
