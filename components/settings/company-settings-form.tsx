"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Organization } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { PermissionGate } from "@/components/shared/permission-gate";
import type { SessionUser } from "@/lib/permissions";
import { updateOrganizationAction } from "@/server/actions/organization.actions";

type CompanySettingsFormProps = {
  organization: Organization;
  user: SessionUser;
};

export function CompanySettingsForm({ organization, user }: CompanySettingsFormProps) {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const result = await updateOrganizationAction(formData);
    setLoading(false);
    if (result.success) {
      toast.success("Paramètres enregistrés avec succès");
    } else {
      toast.error(result.error ?? "Erreur lors de la sauvegarde");
    }
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>Identité commerciale de l&apos;entreprise</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nom commercial</Label>
            <Input id="name" name="name" defaultValue={organization.name} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Nom légal</Label>
            <Input id="legalName" name="legalName" defaultValue={organization.legalName} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={organization.email ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input id="phone" name="phone" defaultValue={organization.phone ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Site web</Label>
            <Input id="website" name="website" defaultValue={organization.website ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input id="logoUrl" name="logoUrl" defaultValue={organization.logoUrl ?? ""} readOnly={!canEdit(user)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations légales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="siret">SIRET</Label>
            <Input id="siret" name="siret" defaultValue={organization.siret ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vatNumber">TVA intracommunautaire</Label>
            <Input id="vatNumber" name="vatNumber" defaultValue={organization.vatNumber ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalForm">Forme juridique</Label>
            <Input id="legalForm" name="legalForm" defaultValue={organization.legalForm ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shareCapital">Capital social</Label>
            <Input id="shareCapital" name="shareCapital" defaultValue={organization.shareCapital ?? ""} readOnly={!canEdit(user)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Adresse</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="addressLine1">Adresse ligne 1</Label>
            <Input id="addressLine1" name="addressLine1" defaultValue={organization.addressLine1 ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="addressLine2">Adresse ligne 2</Label>
            <Input id="addressLine2" name="addressLine2" defaultValue={organization.addressLine2 ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Code postal</Label>
            <Input id="postalCode" name="postalCode" defaultValue={organization.postalCode ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ville</Label>
            <Input id="city" name="city" defaultValue={organization.city ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Pays</Label>
            <Input id="country" name="country" defaultValue={organization.country} readOnly={!canEdit(user)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Localisation</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="defaultCurrency">Devise</Label>
            <Input id="defaultCurrency" name="defaultCurrency" defaultValue={organization.defaultCurrency} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultLocale">Langue</Label>
            <Input id="defaultLocale" name="defaultLocale" defaultValue={organization.defaultLocale} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Fuseau horaire</Label>
            <Input id="timezone" name="timezone" defaultValue={organization.timezone} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fiscalYearStartMonth">Mois début exercice fiscal</Label>
            <Input id="fiscalYearStartMonth" name="fiscalYearStartMonth" type="number" min={1} max={12} defaultValue={organization.fiscalYearStartMonth} readOnly={!canEdit(user)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Préférences documentaires</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="defaultPaymentTermsDays">Délai de paiement (jours)</Label>
            <Input id="defaultPaymentTermsDays" name="defaultPaymentTermsDays" type="number" defaultValue={organization.defaultPaymentTermsDays} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="documentPrefix">Préfixe documents</Label>
            <Input id="documentPrefix" name="documentPrefix" defaultValue={organization.documentPrefix} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Couleur principale</Label>
            <Input
              id="primaryColor"
              name="primaryColor"
              defaultValue={organization.primaryColor}
              readOnly={!canEdit(user)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="defaultInvoiceFooter">Pied de page factures</Label>
            <Textarea id="defaultInvoiceFooter" name="defaultInvoiceFooter" defaultValue={organization.defaultInvoiceFooter ?? ""} readOnly={!canEdit(user)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="defaultQuoteFooter">Pied de page devis</Label>
            <Textarea id="defaultQuoteFooter" name="defaultQuoteFooter" defaultValue={organization.defaultQuoteFooter ?? ""} readOnly={!canEdit(user)} />
          </div>
        </CardContent>
      </Card>

      <PermissionGate user={user} permission="SETTINGS_UPDATE">
        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </Button>
          <Button type="reset" variant="outline">
            Annuler
          </Button>
        </div>
      </PermissionGate>
    </form>
  );
}

function canEdit(user: SessionUser) {
  return user.permissions.includes("SETTINGS_UPDATE");
}
