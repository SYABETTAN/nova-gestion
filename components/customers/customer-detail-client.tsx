"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  FileText,
  Mail,
  Phone,
  Receipt,
  Trash2,
} from "lucide-react";
import type { CustomerTag } from "@prisma/client";
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
import { Label } from "@/components/ui/label";
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
import { CustomerStatusBadge, CustomerTypeBadge } from "@/components/customers/customer-badges";
import {
  CUSTOMER_ACTIVITY_LABELS,
  formatCurrency,
  formatCustomerDisplayName,
} from "@/lib/customer-utils";
import { moneyToNumber } from "@/lib/pricing";
import type { SessionUser } from "@/lib/permissions";
import { formatDate, formatDateShort } from "@/lib/utils";
import {
  archiveCustomerAction,
  reactivateCustomerAction,
} from "@/server/actions/customer.actions";
import {
  createCustomerAddressAction,
  deleteCustomerAddressAction,
  setDefaultAddressAction,
} from "@/server/actions/customer-address.actions";
import {
  createCustomerContactAction,
  deleteCustomerContactAction,
  reactivateCustomerContactAction,
  setPrimaryContactAction,
} from "@/server/actions/customer-contact.actions";
import { createCustomerNoteAction } from "@/server/actions/customer-note.actions";
import {
  assignCustomerTagAction,
  removeCustomerTagAction,
} from "@/server/actions/customer-tag.actions";
import type { MoneyInput } from "@/lib/money";

type CustomerDetail = NonNullable<Awaited<ReturnType<typeof import("@/server/actions/customer.actions").getCustomerByIdAction>>>;

type CustomerDetailClientProps = {
  user: SessionUser;
  customer: CustomerDetail;
  allTags: CustomerTag[];
  recentPayments?: {
    id: string;
    paymentNumber: string;
    paymentDate: Date;
    amount: MoneyInput;
    status: string;
    method: string;
    currency: string;
  }[];
  collectionData?: {
    totalOverdue: number;
    overdueInvoices: {
      id: string;
      invoiceNumber: string;
      amountDue: MoneyInput;
      daysOverdue: number;
      currency: string;
      isDisputed: boolean;
      isCollectionPaused: boolean;
    }[];
    reminders: { id: string; reminderNumber: string; simulatedSentAt: Date | null }[];
    notes: { id: string; type: string; content: string; createdAt: Date }[];
  };
};

export function CustomerDetailClient({ user, customer, allTags, recentPayments = [], collectionData }: CustomerDetailClientProps) {
  const quoteCount = customer.activities.filter((a) => a.type.startsWith("QUOTE")).length;
  const invoiceCount = customer.activities.filter((a) => a.type === "INVOICE_SENT").length;
  const lastActivity = customer.activities[0];

  async function handleArchive() {
    if (!confirm("Archiver ce client ?")) return;
    const result = await archiveCustomerAction(customer.id);
    if (result.success) toast.success("Client archivé");
    else toast.error(result.error ?? "Erreur");
  }

  async function handleReactivate() {
    const result = await reactivateCustomerAction(customer.id);
    if (result.success) toast.success("Client réactivé");
    else toast.error(result.error ?? "Erreur");
  }

  const quoteCreateHref = `/quotes/new?customerId=${customer.id}`;
  const invoiceCreateHref = `/invoices/new?customerId=${customer.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{formatCustomerDisplayName(customer)}</h1>
            <CustomerStatusBadge status={customer.status} />
            <CustomerTypeBadge type={customer.type} />
          </div>
          <p className="mt-1 font-mono text-sm text-[var(--color-muted-foreground)]">
            {customer.customerNumber}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {customer.tagAssignments.map((a) => (
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
          <PermissionGate user={user} permission="CUSTOMERS_UPDATE">
            <Button variant="outline" asChild>
              <Link href={`/customers/${customer.id}/edit`}>Modifier</Link>
            </Button>
          </PermissionGate>
          <PermissionGate user={user} permission="QUOTES_CREATE">
            <Button variant="outline" asChild>
              <Link href={quoteCreateHref}>
                <FileText className="h-4 w-4" /> Créer un devis
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate user={user} permission="INVOICES_CREATE">
            <Button variant="outline" asChild>
              <Link href={invoiceCreateHref}>
                <Receipt className="h-4 w-4" /> Créer une facture
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate user={user} permission="CUSTOMERS_DELETE">
            {customer.isArchived ? (
              <Button variant="secondary" onClick={handleReactivate}>Réactiver</Button>
            ) : (
              <Button variant="destructive" onClick={handleArchive}>Archiver</Button>
            )}
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">CA annuel déclaré</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{customer.annualRevenue ? formatCurrency(customer.annualRevenue) : "—"}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Devis</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{quoteCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Factures envoyées</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{invoiceCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-[var(--color-muted-foreground)]">Encours client</CardTitle></CardHeader>
          <CardContent><p className="text-xl font-bold">{formatCurrency(customer.outstandingAmount, customer.currency)}</p></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({customer.contacts.length})</TabsTrigger>
          <TabsTrigger value="addresses">Adresses ({customer.addresses.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({customer.customerNotes.length})</TabsTrigger>
          <TabsTrigger value="payments">Paiements ({recentPayments.length})</TabsTrigger>
          <TabsTrigger value="collection">Recouvrement</TabsTrigger>
          <TabsTrigger value="activity">Historique ({customer.activities.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><Mail className="mr-2 inline h-4 w-4" />{customer.email ?? "—"}</p>
                <p><Phone className="mr-2 inline h-4 w-4" />{customer.phone ?? "—"}</p>
                <p>Site : {customer.website ?? "—"}</p>
                <p>Ville : {customer.addresses.find((a) => a.isDefault)?.city ?? customer.addresses[0]?.city ?? "—"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Conditions commerciales</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Paiement : {customer.defaultPaymentTermsDays} jours</p>
                <p>TVA : {moneyToNumber(customer.defaultVatRate)} %</p>
                <p>Devise : {customer.currency}</p>
                <p>Encours autorisé : {formatCurrency(customer.creditLimit, customer.currency)}</p>
                <p>Encours actuel : {formatCurrency(customer.outstandingAmount, customer.currency)}</p>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>Informations légales</CardTitle></CardHeader>
              <CardContent className="grid gap-2 text-sm md:grid-cols-2">
                <p>Nom légal : {customer.legalName ?? "—"}</p>
                <p>SIRET : {customer.siret ?? "—"}</p>
                <p>TVA : {customer.vatNumber ?? "—"}</p>
                <p>Forme : {customer.legalForm ?? "—"}</p>
                <p>Secteur : {customer.industry ?? "—"}</p>
                <p>Effectif : {customer.employeeCount ?? "—"}</p>
              </CardContent>
            </Card>
          </div>
          <TagManager user={user} customerId={customer.id} assigned={customer.tagAssignments.map((a) => a.tag)} allTags={allTags} />
          {lastActivity && (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Dernière activité : {lastActivity.title} — {formatDateShort(lastActivity.activityDate)}
            </p>
          )}
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsSection user={user} customerId={customer.id} contacts={customer.contacts} />
        </TabsContent>

        <TabsContent value="addresses">
          <AddressesSection user={user} customerId={customer.id} addresses={customer.addresses} />
        </TabsContent>

        <TabsContent value="notes">
          <NotesSection user={user} customerId={customer.id} notes={customer.customerNotes} />
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Derniers paiements</CardTitle>
              <PermissionGate user={user} permission="PAYMENTS_CREATE">
                <Button size="sm" asChild>
                  <Link href={`/payments/new?customerId=${customer.id}`}>Nouveau paiement</Link>
                </Button>
              </PermissionGate>
            </CardHeader>
            <CardContent>
              {recentPayments.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">Aucun paiement enregistré.</p>
              ) : (
                <div className="space-y-2">
                  {recentPayments.map((p) => (
                    <Link key={p.id} href={`/payments/${p.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-slate-50">
                      <div>
                        <p className="font-mono font-medium">{p.paymentNumber}</p>
                        <p className="text-xs text-[var(--color-muted-foreground)]">{formatDateShort(p.paymentDate)}</p>
                      </div>
                      <p className="font-semibold">{formatCurrency(p.amount, p.currency)}</p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collection">
          <Card>
            <CardHeader><CardTitle>Recouvrement client</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <p>Montant en retard : <strong className="text-red-600">{formatCurrency(collectionData?.totalOverdue ?? 0, customer.currency)}</strong></p>
                <p>Factures en retard : <strong>{collectionData?.overdueInvoices.length ?? 0}</strong></p>
                <p>Relances envoyées : <strong>{collectionData?.reminders.length ?? 0}</strong></p>
              </div>
              {collectionData?.overdueInvoices && collectionData.overdueInvoices.length > 0 && (
                <div className="space-y-2">
                  <p className="font-medium text-sm">Factures à relancer</p>
                  {collectionData.overdueInvoices.map((inv) => (
                    <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between rounded border p-3 hover:bg-slate-50">
                      <span className="font-mono">{inv.invoiceNumber}</span>
                      <span>{formatCurrency(inv.amountDue, inv.currency)} — {inv.daysOverdue} j</span>
                    </Link>
                  ))}
                </div>
              )}
              {collectionData?.notes && collectionData.notes.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <p className="font-medium text-sm">Notes recouvrement</p>
                  {collectionData.notes.map((n) => (
                    <div key={n.id} className="rounded border p-2 text-sm">{n.content}</div>
                  ))}
                </div>
              )}
              <Button size="sm" asChild><Link href="/reminders">Voir le centre de relances</Link></Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <div className="space-y-3">
            {customer.activities.map((activity) => (
              <div key={activity.id} className="flex gap-4 rounded-lg border bg-white p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Badge variant="secondary">{CUSTOMER_ACTIVITY_LABELS[activity.type] ?? activity.type}</Badge>
                </div>
                <div>
                  <p className="font-medium">{activity.title}</p>
                  {activity.description && (
                    <p className="text-sm text-[var(--color-muted-foreground)]">{activity.description}</p>
                  )}
                  <div className="mt-1 flex gap-3 text-xs text-[var(--color-muted-foreground)]">
                    <span>{formatDate(activity.activityDate)}</span>
                    {activity.amount != null && (
                      <span>{formatCurrency(activity.amount, customer.currency)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TagManager({
  user,
  customerId,
  assigned,
  allTags,
}: {
  user: SessionUser;
  customerId: string;
  assigned: CustomerTag[];
  allTags: CustomerTag[];
}) {
  const assignedIds = new Set(assigned.map((t) => t.id));

  return (
    <Card>
      <CardHeader><CardTitle>Tags</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {allTags.map((tag) => {
          const isAssigned = assignedIds.has(tag.id);
          return (
            <PermissionGate key={tag.id} user={user} permission="CUSTOMERS_UPDATE">
              <button
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-medium text-white ${isAssigned ? "ring-2 ring-offset-1 ring-blue-500" : "opacity-50"}`}
                style={{ backgroundColor: tag.color }}
                onClick={async () => {
                  const result = isAssigned
                    ? await removeCustomerTagAction(customerId, tag.id)
                    : await assignCustomerTagAction(customerId, tag.id);
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
  customerId,
  contacts,
}: {
  user: SessionUser;
  customerId: string;
  contacts: CustomerDetail["contacts"];
}) {
  const [showArchivedContacts, setShowArchivedContacts] = useState(false);
  const visibleContacts = contacts.filter((contact) => showArchivedContacts || !contact.isArchived);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <PermissionGate user={user} permission="CUSTOMERS_UPDATE">
          <ContactDialog customerId={customerId} />
        </PermissionGate>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowArchivedContacts((v) => !v)}>
          {showArchivedContacts ? "Masquer les archives" : "Afficher les archives"}
        </Button>
      </div>
      {visibleContacts.map((contact) => (
        <Card key={contact.id}>
          <CardContent className="flex items-start justify-between pt-6">
            <div>
              <p className="font-medium">
                {contact.firstName} {contact.lastName}
                {contact.isPrimary && <Badge className="ml-2" variant="secondary">Principal</Badge>}
                {contact.isArchived && <Badge className="ml-2" variant="outline">Archive</Badge>}
              </p>
              <p className="text-sm text-[var(--color-muted-foreground)]">{contact.jobTitle ?? "—"}</p>
              <p className="text-sm">{contact.email ?? "—"} · {contact.phone ?? contact.mobile ?? "—"}</p>
            </div>
            <PermissionGate user={user} permission="CUSTOMERS_UPDATE">
              <div className="flex gap-2">
                {!contact.isPrimary && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    await setPrimaryContactAction(contact.id);
                    toast.success("Contact principal défini");
                  }} disabled={contact.isArchived}>Principal</Button>
                )}
                {contact.isArchived ? (
                  <Button size="sm" variant="outline" onClick={async () => {
                    const result = await reactivateCustomerContactAction(contact.id);
                    if (result.success) toast.success("Contact réactive");
                  }}>
                    Reactiver
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (!confirm("Archiver le contact ?")) return;
                    await deleteCustomerContactAction(contact.id);
                    toast.success("Contact archive");
                  }}>
                    Archiver le contact
                  </Button>
                )}
              </div>
            </PermissionGate>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ContactDialog({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Ajouter un contact</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau contact</DialogTitle></DialogHeader>
        <form action={async (fd) => {
          const r = await createCustomerContactAction(customerId, fd);
          if (r.success) { toast.success("Contact ajouté"); setOpen(false); }
          else toast.error(r.error);
        }} className="space-y-3">
          <Input name="firstName" placeholder="Prénom *" required />
          <Input name="lastName" placeholder="Nom *" required />
          <Input name="jobTitle" placeholder="Poste" />
          <Input name="email" type="email" placeholder="Email" />
          <Input name="phone" placeholder="Téléphone" />
          <Button type="submit">Ajouter</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddressesSection({
  user,
  customerId,
  addresses,
}: {
  user: SessionUser;
  customerId: string;
  addresses: CustomerDetail["addresses"];
}) {
  const typeLabels = { BILLING: "Facturation", SHIPPING: "Livraison", OTHER: "Autre" };
  return (
    <div className="space-y-4">
      <PermissionGate user={user} permission="CUSTOMERS_UPDATE">
        <AddressDialog customerId={customerId} />
      </PermissionGate>
      {addresses.map((addr) => (
        <Card key={addr.id}>
          <CardContent className="flex items-start justify-between pt-6">
            <div>
              <p className="font-medium">
                {typeLabels[addr.type]} {addr.isDefault && <Badge className="ml-2" variant="secondary">Par défaut</Badge>}
              </p>
              <p className="text-sm">{addr.addressLine1}</p>
              {addr.addressLine2 && <p className="text-sm">{addr.addressLine2}</p>}
              <p className="text-sm">{addr.postalCode} {addr.city}</p>
            </div>
            <PermissionGate user={user} permission="CUSTOMERS_UPDATE">
              <div className="flex gap-2">
                {!addr.isDefault && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    await setDefaultAddressAction(addr.id);
                    toast.success("Adresse par défaut définie");
                  }}>Par défaut</Button>
                )}
                <Button size="sm" variant="ghost" onClick={async () => {
                  if (!confirm("Supprimer cette adresse ?")) return;
                  await deleteCustomerAddressAction(addr.id);
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

function AddressDialog({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("BILLING");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm">Ajouter une adresse</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvelle adresse</DialogTitle></DialogHeader>
        <form action={async (fd) => {
          fd.set("type", type);
          const r = await createCustomerAddressAction(customerId, fd);
          if (r.success) { toast.success("Adresse ajoutée"); setOpen(false); }
          else toast.error(r.error);
        }} className="space-y-3">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
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

function NotesSection({
  user,
  customerId,
  notes,
}: {
  user: SessionUser;
  customerId: string;
  notes: CustomerDetail["customerNotes"];
}) {
  return (
    <div className="space-y-4">
      <PermissionGate user={user} permission="CUSTOMERS_UPDATE">
        <form action={async (fd) => {
          const r = await createCustomerNoteAction(customerId, fd);
          if (r.success) toast.success("Note ajoutée");
          else toast.error(r.error);
        }} className="flex gap-2">
          <Textarea name="content" placeholder="Ajouter une note interne..." className="flex-1" required />
          <Button type="submit">Ajouter</Button>
        </form>
      </PermissionGate>
      {notes.map((note) => (
        <Card key={note.id}>
          <CardContent className="pt-6">
            <p className="text-sm">{note.content}</p>
            <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
              {note.user.name} — {formatDate(note.createdAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
