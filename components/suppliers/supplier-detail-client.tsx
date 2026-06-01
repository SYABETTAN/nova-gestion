"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Mail,
  Phone,
  Receipt,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import type { SupplierTag } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/shared/permission-gate";
import {
  SupplierInvoicePaymentStatusBadge,
  SupplierInvoiceStatusBadge,
} from "@/components/supplier-invoices/supplier-invoice-badges";
import {
  SupplierRiskBadge,
  SupplierStatusBadge,
  SupplierTypeBadge,
} from "@/components/suppliers/supplier-badges";
import {
  formatCurrency,
  formatSupplierDisplayName,
  maskIban,
  SUPPLIER_ACTIVITY_LABELS,
} from "@/lib/supplier-utils";
import { isPositive, moneyAdd, moneyToNumber, type MoneyInput } from "@/lib/money";
import type { SessionUser } from "@/lib/permissions";
import { formatDate, formatDateShort } from "@/lib/utils";
import {
  archiveSupplierAction,
  reactivateSupplierAction,
} from "@/server/actions/supplier.actions";
import {
  createSupplierAddressAction,
  deleteSupplierAddressAction,
  setDefaultSupplierAddressAction,
} from "@/server/actions/supplier-address.actions";
import {
  createSupplierBankAccountAction,
  disableSupplierBankAccountAction,
  setDefaultSupplierBankAccountAction,
} from "@/server/actions/supplier-bank-account.actions";
import {
  createSupplierContactAction,
  deleteSupplierContactAction,
  setPrimarySupplierContactAction,
} from "@/server/actions/supplier-contact.actions";
import { createSupplierNoteAction } from "@/server/actions/supplier-note.actions";
import {
  assignSupplierTagAction,
  removeSupplierTagAction,
} from "@/server/actions/supplier-tag.actions";

type SupplierDetail = NonNullable<Awaited<ReturnType<typeof import("@/server/actions/supplier.actions").getSupplierByIdAction>>>;

type SupplierDetailClientProps = {
  user: SessionUser;
  supplier: SupplierDetail;
  allTags: SupplierTag[];
  supplierInvoices?: {
    id: string;
    supplierInvoiceNumber: string;
    title: string;
    status: string;
    paymentStatus: string;
    totalIncludingTax: MoneyInput;
    amountDue: MoneyInput;
    dueDate: Date;
    issueDate: Date;
    currency: string;
  }[];
};

const ADDRESS_TYPE_LABELS: Record<string, string> = {
  BILLING: "Facturation",
  SHIPPING: "Livraison",
  HEADQUARTERS: "Siège",
  OTHER: "Autre",
};

export function SupplierDetailClient({ user, supplier, allTags, supplierInvoices = [] }: SupplierDetailClientProps) {
  const invoiceCount = supplierInvoices.length;
  const totalDue = moneyToNumber(
    supplierInvoices.reduce((s, i) => moneyAdd(s, i.amountDue), moneyAdd(0, 0)),
  );
  const overdueCount = supplierInvoices.filter(
    (i) => i.paymentStatus === "OVERDUE" || (isPositive(i.amountDue) && i.dueDate < new Date()),
  ).length;
  const lastActivity = supplier.activities[0];
  const activeBankAccounts = supplier.bankAccounts.filter((a) => a.isActive);

  async function handleArchive() {
    if (!confirm("Archiver ce fournisseur ?")) return;
    const result = await archiveSupplierAction(supplier.id);
    if (result.success) toast.success("Fournisseur archivé");
    else toast.error(result.error ?? "Erreur");
  }

  async function handleReactivate() {
    const result = await reactivateSupplierAction(supplier.id);
    if (result.success) toast.success("Fournisseur réactivé");
    else toast.error(result.error ?? "Erreur");
  }

  function placeholderModule(name: string) {
    toast.info(`Module ${name} non encore disponible dans cette `);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{formatSupplierDisplayName(supplier)}</h1>
            <SupplierStatusBadge status={supplier.status} />
            <SupplierTypeBadge type={supplier.type} />
            <SupplierRiskBadge riskLevel={supplier.riskLevel} />
            {supplier.isPreferred && (
              <Badge variant="secondary" className="gap-1">
                <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                Préféré
              </Badge>
            )}
          </div>
          <p className="mt-1 font-mono text-sm text-[var(--color-muted-foreground)]">
            {supplier.supplierNumber}
          </p>
          {supplier.category && (
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Catégorie : {supplier.category.name}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {supplier.tagAssignments.map((a) => (
              <span
                key={a.tag.id}
                className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: a.tag.color }}
              >
                {a.tag.name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGate user={user} permission="SUPPLIERS_UPDATE">
            <Button variant="outline" asChild>
              <Link href={`/suppliers/${supplier.id}/edit`}>Modifier</Link>
            </Button>
          </PermissionGate>
          <PermissionGate user={user} permission="SUPPLIER_INVOICES_CREATE">
            <Button variant="outline" asChild>
              <Link href={`/supplier-invoices/new?supplierId=${supplier.id}`}>
                <Receipt className="h-4 w-4" /> Créer une facture fournisseur
              </Link>
            </Button>
          </PermissionGate>
          <Button variant="outline" onClick={() => placeholderModule("paiements fournisseurs")}>
            <Wallet className="h-4 w-4" /> Créer un paiement fournisseur
          </Button>
          <PermissionGate user={user} permission="SUPPLIERS_DELETE">
            {supplier.isArchived ? (
              <Button variant="secondary" onClick={handleReactivate}>Réactiver</Button>
            ) : (
              <Button variant="destructive" onClick={handleArchive}>Archiver</Button>
            )}
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Achats totaux</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(supplier.totalPurchasesAmount, supplier.currency)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Encours</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(supplier.outstandingAmount, supplier.currency)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Factures fournisseurs</CardTitle></CardHeader>
          <CardContent>
            <p className="text-xl font-bold">{invoiceCount}</p>
            {overdueCount > 0 && <p className="text-sm text-red-600">{overdueCount} en retard</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Montant dû</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(totalDue, supplier.currency)}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({supplier.contacts.length})</TabsTrigger>
          <TabsTrigger value="addresses">Adresses ({supplier.addresses.length})</TabsTrigger>
          <TabsTrigger value="bank">Banque fictive ({activeBankAccounts.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({supplier.supplierNotes.length})</TabsTrigger>
          <TabsTrigger value="invoices">Factures ({invoiceCount})</TabsTrigger>
          <TabsTrigger value="activity">Historique ({supplier.activities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><Mail className="mr-2 inline h-4 w-4" />{supplier.email ?? "—"}</p>
                <p><Phone className="mr-2 inline h-4 w-4" />{supplier.phone ?? "—"}</p>
                <p>Site : {supplier.website ?? "—"}</p>
                <p>Ville : {supplier.addresses.find((a) => a.isDefault)?.city ?? supplier.addresses[0]?.city ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Conditions commerciales</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Paiement : {supplier.defaultPaymentTermsDays} jours</p>
                <p>TVA : {moneyToNumber(supplier.defaultVatRate)} %</p>
                <p>Devise : {supplier.currency}</p>
                <p>Encours : {formatCurrency(supplier.outstandingAmount, supplier.currency)}</p>
                <p>Total achats : {formatCurrency(supplier.totalPurchasesAmount, supplier.currency)}</p>
                <p>Risque : <SupplierRiskBadge riskLevel={supplier.riskLevel} /></p>
                <p>Préféré : {supplier.isPreferred ? "Oui" : "Non"}</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Informations légales</CardTitle></CardHeader>
              <CardContent className="grid gap-2 text-sm md:grid-cols-2">
                <p>Nom légal : {supplier.legalName ?? "—"}</p>
                <p>SIRET : {supplier.siret ?? "—"}</p>
                <p>TVA : {supplier.vatNumber ?? "—"}</p>
                <p>Forme : {supplier.legalForm ?? "—"}</p>
                <p>Secteur : {supplier.industry ?? "—"}</p>
              </CardContent>
            </Card>
          </div>
          <TagManager
            user={user}
            supplierId={supplier.id}
            assigned={supplier.tagAssignments.map((a) => a.tag)}
            allTags={allTags}
          />
          {lastActivity && (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Dernière activité : {lastActivity.title} — {formatDateShort(lastActivity.activityDate)}
            </p>
          )}
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsSection user={user} supplierId={supplier.id} contacts={supplier.contacts} />
        </TabsContent>

        <TabsContent value="addresses">
          <AddressesSection user={user} supplierId={supplier.id} addresses={supplier.addresses} />
        </TabsContent>

        <TabsContent value="bank">
          <BankSection user={user} supplierId={supplier.id} bankAccounts={supplier.bankAccounts} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesSection user={user} supplierId={supplier.id} notes={supplier.supplierNotes} />
        </TabsContent>

        <TabsContent value="invoices">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Dernières factures fournisseurs.
              </p>
              <PermissionGate user={user} permission="SUPPLIER_INVOICES_READ">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/supplier-invoices?supplierId=${supplier.id}`}>Voir toutes</Link>
                </Button>
              </PermissionGate>
              <PermissionGate user={user} permission="SUPPLIER_INVOICES_CREATE">
                <Button size="sm" asChild>
                  <Link href={`/supplier-invoices/new?supplierId=${supplier.id}`}>
                    Nouvelle facture
                  </Link>
                </Button>
              </PermissionGate>
            </div>
            {supplierInvoices.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                Aucune facture fournisseur pour ce fournisseur.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="border-b bg-[var(--color-muted)]/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Numéro</th>
                      <th className="px-4 py-2 text-left font-medium">Titre</th>
                      <th className="px-4 py-2 text-left font-medium">Statut</th>
                      <th className="px-4 py-2 text-left font-medium">Paiement</th>
                      <th className="px-4 py-2 text-right font-medium">TTC</th>
                      <th className="px-4 py-2 text-right font-medium">Reste dû</th>
                      <th className="px-4 py-2 text-left font-medium">Échéance</th>
                      <th className="px-4 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierInvoices.map((inv) => (
                      <tr key={inv.id} className="border-b last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">{inv.supplierInvoiceNumber}</td>
                        <td className="px-4 py-2">{inv.title}</td>
                        <td className="px-4 py-2">
                          <SupplierInvoiceStatusBadge status={inv.status as "DRAFT" | "VALIDATED" | "CANCELLED" | "ARCHIVED"} />
                        </td>
                        <td className="px-4 py-2">
                          <SupplierInvoicePaymentStatusBadge
                            status={inv.paymentStatus as "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE"}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">{formatCurrency(inv.totalIncludingTax, inv.currency)}</td>
                        <td className="px-4 py-2 text-right">{formatCurrency(inv.amountDue, inv.currency)}</td>
                        <td className="px-4 py-2">{formatDateShort(inv.dueDate)}</td>
                        <td className="px-4 py-2 text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/supplier-invoices/${inv.id}`}>Voir</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity">
          <div className="space-y-3">
            {supplier.activities.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">Aucune activité enregistrée.</p>
            ) : (
              supplier.activities.map((activity) => (
                <div key={activity.id} className="flex gap-4 rounded-lg border bg-white p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{activity.title}</p>
                      <Badge variant="secondary">
                        {SUPPLIER_ACTIVITY_LABELS[activity.type] ?? activity.type}
                      </Badge>
                    </div>
                    {activity.description && (
                      <p className="text-sm text-[var(--color-muted-foreground)]">{activity.description}</p>
                    )}
                    <div className="mt-1 flex gap-3 text-xs text-[var(--color-muted-foreground)]">
                      <span>{formatDate(activity.activityDate)}</span>
                      {activity.amount != null && (
                        <span>{formatCurrency(activity.amount, supplier.currency)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TagManager({
  user,
  supplierId,
  assigned,
  allTags,
}: {
  user: SessionUser;
  supplierId: string;
  assigned: SupplierTag[];
  allTags: SupplierTag[];
}) {
  const assignedIds = new Set(assigned.map((t) => t.id));

  return (
    <Card>
      <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {allTags.map((tag) => {
          const isAssigned = assignedIds.has(tag.id);
          return (
            <PermissionGate key={tag.id} user={user} permission="SUPPLIERS_UPDATE">
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-medium text-white ${isAssigned ? "ring-2 ring-offset-1 ring-blue-500" : "opacity-50"}`}
                style={{ backgroundColor: tag.color }}
                onClick={async () => {
                  const result = isAssigned
                    ? await removeSupplierTagAction(supplierId, tag.id)
                    : await assignSupplierTagAction(supplierId, tag.id);
                  if (result.success) toast.success(isAssigned ? "Tag retiré" : "Tag assigné");
                }}
              >
                {tag.name}
              </button>
            </PermissionGate>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ContactsSection({
  user,
  supplierId,
  contacts,
}: {
  user: SessionUser;
  supplierId: string;
  contacts: SupplierDetail["contacts"];
}) {
  return (
    <div className="space-y-4">
      <PermissionGate user={user} permission="SUPPLIERS_UPDATE">
        <ContactDialog supplierId={supplierId} />
      </PermissionGate>
      {contacts.length === 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)]">Aucun contact enregistré.</p>
      )}
      {contacts.map((contact) => (
        <Card key={contact.id}>
          <CardContent className="flex items-start justify-between pt-6">
            <div>
              <p className="font-medium">
                {contact.firstName} {contact.lastName}
                {contact.isPrimary && <Badge className="ml-2" variant="secondary">Principal</Badge>}
              </p>
              <p className="text-sm text-[var(--color-muted-foreground)]">{contact.jobTitle ?? "—"}</p>
              <p className="text-sm">{contact.email ?? "—"} · {contact.phone ?? contact.mobile ?? "—"}</p>
            </div>
            <PermissionGate user={user} permission="SUPPLIERS_UPDATE">
              <div className="flex gap-2">
                {!contact.isPrimary && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    await setPrimarySupplierContactAction(contact.id);
                    toast.success("Contact principal défini");
                  }}>Principal</Button>
                )}
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm("Supprimer ce contact ?")) return;
                  await deleteSupplierContactAction(contact.id);
                  toast.success("Contact supprimé");
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </PermissionGate>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ContactDialog({ supplierId }: { supplierId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Ajouter un contact</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau contact</DialogTitle></DialogHeader>
        <form action={async (fd) => {
          const r = await createSupplierContactAction(supplierId, fd);
          if (r.success) { toast.success("Contact ajouté"); setOpen(false); }
          else toast.error(r.error);
        }} className="space-y-3">
          <Input name="firstName" placeholder="Prénom *" required />
          <Input name="lastName" placeholder="Nom *" required />
          <Input name="jobTitle" placeholder="Poste" />
          <Input name="email" type="email" placeholder="Email" />
          <Input name="phone" placeholder="Téléphone" />
          <Input name="mobile" placeholder="Mobile" />
          <Button type="submit">Ajouter</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddressesSection({
  user,
  supplierId,
  addresses,
}: {
  user: SessionUser;
  supplierId: string;
  addresses: SupplierDetail["addresses"];
}) {
  return (
    <div className="space-y-4">
      <PermissionGate user={user} permission="SUPPLIERS_UPDATE">
        <AddressDialog supplierId={supplierId} />
      </PermissionGate>
      {addresses.length === 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)]">Aucune adresse enregistrée.</p>
      )}
      {addresses.map((addr) => (
        <Card key={addr.id}>
          <CardContent className="flex items-start justify-between pt-6">
            <div>
              <p className="font-medium">
                {ADDRESS_TYPE_LABELS[addr.type] ?? addr.type}
                {addr.label && ` — ${addr.label}`}
                {addr.isDefault && <Badge className="ml-2" variant="secondary">Par défaut</Badge>}
              </p>
              <p className="text-sm">{addr.addressLine1}</p>
              {addr.addressLine2 && <p className="text-sm">{addr.addressLine2}</p>}
              <p className="text-sm">{addr.postalCode} {addr.city}</p>
            </div>
            <PermissionGate user={user} permission="SUPPLIERS_UPDATE">
              <div className="flex gap-2">
                {!addr.isDefault && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    await setDefaultSupplierAddressAction(addr.id);
                    toast.success("Adresse par défaut définie");
                  }}>Par défaut</Button>
                )}
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm("Supprimer cette adresse ?")) return;
                  await deleteSupplierAddressAction(addr.id);
                  toast.success("Adresse supprimée");
                }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </PermissionGate>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AddressDialog({ supplierId }: { supplierId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("HEADQUARTERS");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Ajouter une adresse</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle adresse</DialogTitle></DialogHeader>
        <form action={async (fd) => {
          fd.set("type", type);
          const r = await createSupplierAddressAction(supplierId, fd);
          if (r.success) { toast.success("Adresse ajoutée"); setOpen(false); }
          else toast.error(r.error);
        }} className="space-y-3">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="HEADQUARTERS">Siège</SelectItem>
              <SelectItem value="BILLING">Facturation</SelectItem>
              <SelectItem value="SHIPPING">Livraison</SelectItem>
              <SelectItem value="OTHER">Autre</SelectItem>
            </SelectContent>
          </Select>
          <Input name="addressLine1" placeholder="Adresse *" required />
          <Input name="addressLine2" placeholder="Complément" />
          <div className="grid grid-cols-2 gap-2">
            <Input name="postalCode" placeholder="CP *" required />
            <Input name="city" placeholder="Ville *" required />
          </div>
          <Input name="country" defaultValue="FR" />
          <Button type="submit">Ajouter</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BankSection({
  user,
  supplierId,
  bankAccounts,
}: {
  user: SessionUser;
  supplierId: string;
  bankAccounts: SupplierDetail["bankAccounts"];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        Coordonnées bancaires du fournisseur.
      </div>
      <PermissionGate user={user} permission="SUPPLIERS_BANK_DETAILS_UPDATE">
        <BankDialog supplierId={supplierId} />
      </PermissionGate>
      {bankAccounts.length === 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)]">Aucun compte bancaire enregistré.</p>
      )}
      {bankAccounts.map((account) => (
        <Card key={account.id} className={!account.isActive ? "opacity-60" : undefined}>
          <CardContent className="flex items-start justify-between pt-6">
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {account.label}
                {account.isDefault && <Badge className="ml-2" variant="secondary">Par défaut</Badge>}
                {!account.isActive && <Badge className="ml-2" variant="outline">Inactif</Badge>}
              </p>
              <p className="font-mono">IBAN : {maskIban(account.iban)}</p>
              <p>BIC : {account.bic ?? "—"}</p>
              <p>Banque : {account.bankName ?? "—"}</p>
              <p>Titulaire : {account.accountHolder ?? "—"}</p>
            </div>
            {account.isActive && (
              <PermissionGate user={user} permission="SUPPLIERS_BANK_DETAILS_UPDATE">
                <div className="flex gap-2">
                  {!account.isDefault && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      await setDefaultSupplierBankAccountAction(account.id);
                      toast.success("Compte par défaut défini");
                    }}>Par défaut</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (!confirm("Désactiver ce compte bancaire ?")) return;
                    await disableSupplierBankAccountAction(account.id);
                    toast.success("Compte désactivé");
                  }}>
                    Désactiver
                  </Button>
                </div>
              </PermissionGate>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BankDialog({ supplierId }: { supplierId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Ajouter un compte bancaire</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau compte bancaire</DialogTitle></DialogHeader>
        <p className="text-xs text-amber-700">Coordonnées bancaires fournisseur.</p>
        <form action={async (fd) => {
          const r = await createSupplierBankAccountAction(supplierId, fd);
          if (r.success) { toast.success("Compte ajouté"); setOpen(false); }
          else toast.error(r.error);
        }} className="space-y-3">
          <Input name="label" placeholder="Libellé *" required />
          <Input name="iban" placeholder="IBAN *" required />
          <Input name="bic" placeholder="BIC" />
          <Input name="bankName" placeholder="Banque fictive" />
          <Input name="accountHolder" placeholder="Titulaire" />
          <Button type="submit">Ajouter</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NotesSection({
  user,
  supplierId,
  notes,
}: {
  user: SessionUser;
  supplierId: string;
  notes: SupplierDetail["supplierNotes"];
}) {
  return (
    <div className="space-y-4">
      <PermissionGate user={user} permission="SUPPLIERS_UPDATE">
        <form action={async (fd) => {
          const r = await createSupplierNoteAction(supplierId, fd);
          if (r.success) toast.success("Note ajoutée");
          else toast.error(r.error);
        }} className="flex gap-2">
          <Textarea name="content" placeholder="Ajouter une note interne..." className="flex-1" required />
          <Button type="submit">Ajouter</Button>
        </form>
      </PermissionGate>
      {notes.length === 0 && (
        <p className="text-sm text-[var(--color-muted-foreground)]">Aucune note interne.</p>
      )}
      {notes.map((note) => (
        <Card key={note.id}>
          <CardContent className="pt-6">
            <p className="text-sm">{note.content}</p>
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
              {note.user?.name ?? "Utilisateur"} — {formatDate(note.createdAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
