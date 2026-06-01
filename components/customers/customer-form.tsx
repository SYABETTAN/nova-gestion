"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { CustomerTag } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createCustomerAction, updateCustomerAction } from "@/server/actions/customer.actions";
import { moneyToNumber, type MoneyInput } from "@/lib/money";

type CustomerFormData = {
  type?: string;
  status?: string;
  name?: string;
  legalName?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  siret?: string | null;
  vatNumber?: string | null;
  legalForm?: string | null;
  industry?: string | null;
  employeeCount?: number | null;
  annualRevenue?: MoneyInput | null;
  defaultPaymentTermsDays?: number;
  defaultVatRate?: MoneyInput;
  currency?: string;
  creditLimit?: MoneyInput;
  outstandingAmount?: MoneyInput;
  notes?: string | null;
  tagAssignments?: { tagId: string }[];
};

type CustomerFormProps = {
  mode: "create" | "edit";
  customer?: CustomerFormData;
  customerId?: string;
  tags: CustomerTag[];
};

export function CustomerForm({ mode, customer, customerId, tags }: CustomerFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(customer?.type ?? "COMPANY");
  const [status, setStatus] = useState(customer?.status ?? "PROSPECT");
  const [addressType, setAddressType] = useState("BILLING");
  const selectedTagIds = customer?.tagAssignments?.map((a) => a.tagId) ?? [];

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const tagCheckboxes = formData.getAll("tagCheckbox") as string[];
    formData.set("tagIds", tagCheckboxes.join(","));

    const result =
      mode === "create"
        ? await createCustomerAction(formData)
        : await updateCustomerAction(customerId!, formData);

    setLoading(false);

    if (result.success) {
      toast.success(mode === "create" ? "Client créé avec succès" : "Client mis à jour");
      if (mode === "create" && "customerId" in result) {
        router.push(`/customers/${result.customerId}`);
      } else {
        router.push(`/customers/${customerId}`);
      }
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="status" value={status} />
      {mode === "create" && <input type="hidden" name="addressType" value={addressType} />}
      <Card>
        <CardHeader>
          <CardTitle>Identité</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="COMPANY">Société</SelectItem>
                <SelectItem value="INDIVIDUAL">Particulier</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PROSPECT">Prospect</SelectItem>
                <SelectItem value="ACTIVE">Client actif</SelectItem>
                <SelectItem value="INACTIVE">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nom *</Label>
            <Input id="name" name="name" defaultValue={customer?.name ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Nom légal</Label>
            <Input id="legalName" name="legalName" defaultValue={customer?.legalName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Nom d&apos;affichage</Label>
            <Input id="displayName" name="displayName" defaultValue={customer?.displayName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Secteur d&apos;activité</Label>
            <Input id="industry" name="industry" defaultValue={customer?.industry ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalForm">Forme juridique</Label>
            <Input id="legalForm" name="legalForm" defaultValue={customer?.legalForm ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="website">Site web</Label>
            <Input id="website" name="website" defaultValue={customer?.website ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Informations légales</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siret">SIRET</Label>
            <Input id="siret" name="siret" defaultValue={customer?.siret ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vatNumber">TVA intracommunautaire</Label>
            <Input id="vatNumber" name="vatNumber" defaultValue={customer?.vatNumber ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employeeCount">Effectif</Label>
            <Input id="employeeCount" name="employeeCount" type="number" min={0} defaultValue={customer?.employeeCount ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="annualRevenue">CA annuel déclaré (€)</Label>
            <Input id="annualRevenue" name="annualRevenue" type="number" min={0} defaultValue={customer?.annualRevenue != null ? moneyToNumber(customer.annualRevenue) : ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Conditions commerciales</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currency">Devise</Label>
            <Input id="currency" name="currency" defaultValue={customer?.currency ?? "EUR"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultPaymentTermsDays">Délai paiement (jours)</Label>
            <Input id="defaultPaymentTermsDays" name="defaultPaymentTermsDays" type="number" min={0} max={120} defaultValue={customer?.defaultPaymentTermsDays ?? 30} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultVatRate">TVA par défaut (%)</Label>
            <Input id="defaultVatRate" name="defaultVatRate" type="number" min={0} max={100} defaultValue={customer?.defaultVatRate != null ? moneyToNumber(customer.defaultVatRate) : 20} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="creditLimit">Encours autorisé (€)</Label>
            <Input id="creditLimit" name="creditLimit" type="number" min={0} defaultValue={customer?.creditLimit != null ? moneyToNumber(customer.creditLimit) : 0} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="outstandingAmount">Encours actuel (€)</Label>
            <Input id="outstandingAmount" name="outstandingAmount" type="number" min={0} defaultValue={customer?.outstandingAmount != null ? moneyToNumber(customer.outstandingAmount) : 0} />
          </div>
        </CardContent>
      </Card>

      {mode === "create" && (
        <>
          <Card>
            <CardHeader><CardTitle>Adresse principale</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type adresse</Label>
                <Select value={addressType} onValueChange={setAddressType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BILLING">Facturation</SelectItem>
                    <SelectItem value="SHIPPING">Livraison</SelectItem>
                    <SelectItem value="OTHER">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="addressLine1">Adresse ligne 1</Label>
                <Input id="addressLine1" name="addressLine1" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="addressLine2">Adresse ligne 2</Label>
                <Input id="addressLine2" name="addressLine2" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input id="postalCode" name="postalCode" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" name="city" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Région</Label>
                <Input id="region" name="region" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Pays</Label>
                <Input id="country" name="country" defaultValue="FR" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contact principal</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactFirstName">Prénom</Label>
                <Input id="contactFirstName" name="contactFirstName" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactLastName">Nom</Label>
                <Input id="contactLastName" name="contactLastName" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactJobTitle">Poste</Label>
                <Input id="contactJobTitle" name="contactJobTitle" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input id="contactEmail" name="contactEmail" type="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Téléphone</Label>
                <Input id="contactPhone" name="contactPhone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactMobile">Mobile</Label>
                <Input id="contactMobile" name="contactMobile" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
          <CardDescription>Sélectionnez les tags à associer</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="tagCheckbox"
                value={tag.id}
                defaultChecked={selectedTagIds.includes(tag.id)}
              />
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Notes internes</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            name={mode === "create" ? "noteContent" : "notes"}
            defaultValue={mode === "edit" ? (customer?.notes ?? "") : ""}
            placeholder="Notes internes visibles uniquement par l'équipe..."
          />
        </CardContent>
      </Card>

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : mode === "create" ? "Créer le client" : "Enregistrer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
