"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { SupplierTag } from "@prisma/client";
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
import { createSupplierAction, updateSupplierAction } from "@/server/actions/supplier.actions";
import type { MoneyInput } from "@/lib/money";
import { moneyToNumber } from "@/lib/money";

type SupplierCategoryOption = {
  id: string;
  name: string;
};

type SupplierFormData = {
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
  categoryId?: string | null;
  defaultPaymentTermsDays?: number;
  defaultVatRate?: MoneyInput;
  currency?: string;
  outstandingAmount?: MoneyInput;
  totalPurchasesAmount?: MoneyInput;
  riskLevel?: string;
  isPreferred?: boolean;
  notes?: string | null;
  tagAssignments?: { tagId: string }[];
};

type SupplierFormProps = {
  mode: "create" | "edit";
  supplier?: SupplierFormData;
  supplierId?: string;
  tags: SupplierTag[];
  categories: SupplierCategoryOption[];
};

export function SupplierForm({ mode, supplier, supplierId, tags, categories }: SupplierFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState(supplier?.type ?? "COMPANY");
  const [status, setStatus] = useState(supplier?.status ?? "ACTIVE");
  const [riskLevel, setRiskLevel] = useState(supplier?.riskLevel ?? "LOW");
  const [categoryId, setCategoryId] = useState(supplier?.categoryId ?? "");
  const [addressType, setAddressType] = useState("HEADQUARTERS");
  const selectedTagIds = supplier?.tagAssignments?.map((a) => a.tagId) ?? [];

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const tagCheckboxes = formData.getAll("tagCheckbox") as string[];
    formData.set("tagIds", tagCheckboxes.join(","));
    formData.set("categoryId", categoryId);

    const result =
      mode === "create"
        ? await createSupplierAction(formData)
        : await updateSupplierAction(supplierId!, formData);

    setLoading(false);

    if (result.success) {
      toast.success(mode === "create" ? "Fournisseur créé avec succès" : "Fournisseur mis à jour");
      if (mode === "create" && "supplierId" in result) {
        router.push(`/suppliers/${result.supplierId}`);
      } else {
        router.push(`/suppliers/${supplierId}`);
      }
    } else {
      toast.error(result.error ?? "Erreur");
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="riskLevel" value={riskLevel} />
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
                <SelectItem value="ACTIVE">Actif</SelectItem>
                <SelectItem value="INACTIVE">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nom *</Label>
            <Input id="name" name="name" defaultValue={supplier?.name ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Nom légal</Label>
            <Input id="legalName" name="legalName" defaultValue={supplier?.legalName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Nom d&apos;affichage</Label>
            <Input id="displayName" name="displayName" defaultValue={supplier?.displayName ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="categoryId">Catégorie</Label>
            <Select value={categoryId || "none"} onValueChange={(v) => setCategoryId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Secteur d&apos;activité</Label>
            <Input id="industry" name="industry" defaultValue={supplier?.industry ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalForm">Forme juridique</Label>
            <Input id="legalForm" name="legalForm" defaultValue={supplier?.legalForm ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="riskLevel">Niveau de risque</Label>
            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Risque faible</SelectItem>
                <SelectItem value="MEDIUM">Risque moyen</SelectItem>
                <SelectItem value="HIGH">Risque élevé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              type="checkbox"
              id="isPreferred"
              name="isPreferred"
              defaultChecked={supplier?.isPreferred ?? false}
              className="h-4 w-4 rounded border"
            />
            <Label htmlFor="isPreferred">Fournisseur préféré</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Coordonnées</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={supplier?.email ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" defaultValue={supplier?.phone ?? ""} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="website">Site web</Label>
            <Input id="website" name="website" defaultValue={supplier?.website ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Informations légales</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siret">SIRET</Label>
            <Input id="siret" name="siret" defaultValue={supplier?.siret ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vatNumber">TVA intracommunautaire</Label>
            <Input id="vatNumber" name="vatNumber" defaultValue={supplier?.vatNumber ?? ""} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Conditions commerciales</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currency">Devise</Label>
            <Input id="currency" name="currency" defaultValue={supplier?.currency ?? "EUR"} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultPaymentTermsDays">Délai paiement (jours)</Label>
            <Input
              id="defaultPaymentTermsDays"
              name="defaultPaymentTermsDays"
              type="number"
              min={0}
              max={120}
              defaultValue={supplier?.defaultPaymentTermsDays ?? 30}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultVatRate">TVA par défaut (%)</Label>
            <Input
              id="defaultVatRate"
              name="defaultVatRate"
              type="number"
              min={0}
              max={100}
              defaultValue={supplier?.defaultVatRate != null ? moneyToNumber(supplier.defaultVatRate) : 20}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="outstandingAmount">Encours fournisseur (€)</Label>
            <Input
              id="outstandingAmount"
              name="outstandingAmount"
              type="number"
              min={0}
              defaultValue={supplier?.outstandingAmount != null ? moneyToNumber(supplier.outstandingAmount) : 0}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="totalPurchasesAmount">Total achats (€)</Label>
            <Input
              id="totalPurchasesAmount"
              name="totalPurchasesAmount"
              type="number"
              min={0}
              defaultValue={supplier?.totalPurchasesAmount != null ? moneyToNumber(supplier.totalPurchasesAmount) : 0}
            />
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
                    <SelectItem value="HEADQUARTERS">Siège</SelectItem>
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

          <Card>
            <CardHeader>
              <CardTitle>Coordonnées bancaires fictives</CardTitle>
              <CardDescription className="text-amber-700">
                Coordonnées bancaires fournisseur. Ne saisissez pas de vraies données bancaires.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bankLabel">Libellé</Label>
                <Input id="bankLabel" name="bankLabel" placeholder="Compte principal" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankIban">IBAN</Label>
                <Input id="bankIban" name="bankIban" placeholder="FR76 3000 6000 0112 3456 7890 189" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankBic">BIC</Label>
                <Input id="bankBic" name="bankBic" placeholder="BNPAFRPP" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankName">Banque fictive</Label>
                <Input id="bankName" name="bankName" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bankAccountHolder">Titulaire</Label>
                <Input id="bankAccountHolder" name="bankAccountHolder" />
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
            defaultValue={mode === "edit" ? (supplier?.notes ?? "") : ""}
            placeholder="Notes internes visibles uniquement par l'équipe..."
          />
        </CardContent>
      </Card>

      <Separator />

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? "Enregistrement..." : mode === "create" ? "Créer le fournisseur" : "Enregistrer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annuler
        </Button>
      </div>
    </form>
  );
}
