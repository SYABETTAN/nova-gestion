import Link from "next/link";
import { APP_DISPLAY_NAME } from "@/lib/branding";
import {
  Building2,
  Calculator,
  Coins,
  FileStack,
  Flag,
  Globe,
  Hash,
  Layers,
  Receipt,
  Scale,
  ShoppingCart,
  Truck,
  Users,
  Bell,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SettingsCompletionStatus } from "@/lib/settings";

type SettingsCard = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  configured?: boolean;
};

const sections: { title: string; cards: SettingsCard[] }[] = [
  {
    title: "Entreprise",
    cards: [
      { title: "Informations générales", description: "Coordonnées et identité légale", href: "/settings/company", icon: Building2 },
      { title: "Équipe", description: "Membres et rôles", href: "/settings/team", icon: Users },
      { title: "Numérotation", description: "Séquences de numéros", href: "/settings/numbering", icon: Hash },
      { title: "Localisation", description: "Langue, fuseau horaire, formats", href: "/settings/localization", icon: Globe },
    ],
  },
  {
    title: "Fiscalité",
    cards: [
      { title: "TVA et taxes", description: "Taux de TVA indicatifs", href: "/settings/taxes", icon: Receipt },
      { title: "Conditions de paiement", description: "Délais de règlement", href: "/settings/payment-terms", icon: Coins },
      { title: "Devises", description: "Devises", href: "/settings/currencies", icon: Globe },
    ],
  },
  {
    title: "Commercial",
    cards: [
      { title: "Préférences commerciales", description: "Devis et ventes", href: "/settings/commercial", icon: ShoppingCart },
      { title: "Préférences facturation", description: "Factures et avoirs", href: "/settings/invoicing", icon: Receipt },
      { title: "Relances", description: "Modèles de relance", href: "/reminders/templates", icon: Bell },
    ],
  },
  {
    title: "Achats & fournisseurs",
    cards: [
      { title: "Préférences fournisseurs", description: "Achats et dépenses", href: "/settings/suppliers", icon: Truck },
    ],
  },
  {
    title: "Comptabilité légère",
    cards: [
      { title: "Préférences comptables", description: "Journaux et génération", href: "/settings/accounting", icon: Scale },
      { title: "Mapping comptable", description: "Comptes par type d'opération", href: "/settings/accounting-mapping", icon: Layers },
      { title: "Plan comptable", description: "Comptes", href: "/accounting/accounts", icon: Calculator },
    ],
  },
  {
    title: "Documents & exports",
    cards: [
      { title: "Modèles de documents", description: "En-têtes et pieds de page", href: "/documents/templates", icon: FileStack },
      { title: "Centre d'exports", description: "Exports CSV/JSON", href: "/exports", icon: Receipt },
    ],
  },
  {
    title: "Système",
    cards: [
      { title: "Notifications", description: "Préférences de notification", href: "/settings/notifications", icon: Bell },
      { title: "Modules activés", description: "Feature flags", href: "/settings/features", icon: Flag },
      { title: "Champs personnalisés", description: "Définitions simples", href: "/settings/custom-fields", icon: Wrench },
      { title: "Journal d'audit", description: "Historique des actions", href: "/settings/audit-log", icon: Hash },
    ],
  },
];

function cardConfigured(href: string, completion: SettingsCompletionStatus): boolean | undefined {
  if (href === "/settings/taxes") return completion.hasDefaultTaxRate;
  if (href === "/settings/payment-terms") return completion.hasDefaultPaymentTerm;
  if (href === "/settings/accounting-mapping") return completion.hasAccountingMappings;
  if (href === "/documents/templates") return completion.hasDocumentTemplates;
  return undefined;
}

export function SettingsCenter({ completion }: { completion: SettingsCompletionStatus }) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Paramètres</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Configurez votre organisation {APP_DISPLAY_NAME}.
        </p>
      </div>


      {!completion.isComplete ? (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6 text-sm text-blue-900">
            Configuration incomplète : vérifiez la TVA par défaut, les conditions de paiement, le
            mapping comptable et les modèles de documents.
          </CardContent>
        </Card>
      ) : null}

      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {section.cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link key={card.href} href={card.href}>
                  <Card className="h-full transition hover:border-blue-300 hover:shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 text-blue-600" />
                          <CardTitle className="text-base">{card.title}</CardTitle>
                        </div>
                        {(() => {
                          const configured = card.configured ?? cardConfigured(card.href, completion);
                          if (configured === undefined) return null;
                          return (
                            <Badge variant={configured ? "success" : "secondary"}>
                              {configured ? "OK" : "À configurer"}
                            </Badge>
                          );
                        })()}
                      </div>
                      <CardDescription>{card.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <span className="text-sm font-medium text-blue-600">Configurer →</span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
