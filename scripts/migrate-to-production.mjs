import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".next", ".git", "scripts/migrate-to-production.mjs"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(tsx?|md)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const replacements = [
  [/-sandbox\.csv/g, ".csv"],
  [/Environnement sandbox — données fictives/g, ""],
  [/Tableau de bord sandbox — données fictives\./g, "Indicateurs calculés à partir de vos données."],
  [/Recherche sandbox — résultats issus de données fictives\./g, "Recherchez clients, factures, devis et plus."],
  [/Configurez votre environnement sandbox Nova Gestion\./g, "Configurez votre organisation Joey & Joey."],
  [/Configurez votre organisation Nova Gestion\./g, "Configurez votre organisation Joey & Joey."],
  [/Devises sandbox/g, "Devises"],
  [/Notifications sandbox/g, "Notifications"],
  [/Modules sandbox/g, "Modules"],
  [/En-têtes et pieds de page sandbox/g, "En-têtes et pieds de page"],
  [/Jobs d'export sandbox enregistrés/g, "Historique des exports"],
  [/Centralisez les exports sandbox de vos données\./g, "Centralisez les exports de vos données."],
  [/Exports sandbox — fichiers non certifiés/g, "Exports — vérifiez les données avant usage comptable"],
  [/Document sandbox — sans valeur légale\. Téléchargement simulé uniquement\./g, "Document généré par Joey & Joey."],
  [/Document sandbox — aucune valeur comptable ou légale/g, "Reçu de paiement"],
  [/Document généré en environnement sandbox — sans valeur légale\./g, ""],
  [/Export PDF sandbox via impression navigateur\./g, "Export PDF via impression navigateur."],
  [/Comptabilité légère sandbox — indicateurs non certifiés\./g, "Comptabilité légère — indicateurs indicatifs."],
  [/Comptabilité légère sandbox — données fictives, non certifiées\./g, "Comptabilité légère — vérifiez vos écritures avant clôture."],
  [/Pré-comptabilité sandbox — non certifiée\./g, "Pré-comptabilité — à valider avec votre expert-comptable."],
  [/Suivez vos écritures sandbox issues des ventes, paiements et dépenses\./g, "Suivez vos écritures issues des ventes, paiements et dépenses."],
  [/Brouillard et écritures validées sandbox\./g, "Brouillard et écritures validées."],
  [/Créez et suivez vos factures dans l'environnement sandbox\./g, "Créez et suivez vos factures."],
  [/Créez et suivez vos devis dans l'environnement sandbox\./g, "Créez et suivez vos devis."],
  [/Suivez les règlements clients dans l'environnement sandbox\./g, "Suivez les règlements clients."],
  [/Taux indicatifs pour la sandbox — non certifiés fiscalement\./g, "Configurez vos taux de TVA."],
  [/Taux de change sandbox — non actualisés\./g, "Taux de change — mettez à jour selon votre politique."],
  [/Préférences de formatage pour la sandbox\./g, "Préférences de formatage régionales."],
  [/Les emails sont simulés dans cet environnement sandbox\./g, "Configurez les notifications par canal."],
  [/Journaux et génération automatique \(sandbox\)\./g, "Journaux et génération automatique."],
  [/Les documents sandbox ne sont pas juridiquement opposables\./g, "Vérifiez les mentions légales sur vos documents."],
  [/Autoriser suppression brouillon \(sandbox\)/g, "Autoriser suppression brouillon"],
  [/Afficher mention sandbox/g, "Afficher mention brouillon sur documents"],
  [/Coordonnées bancaires fictives — sandbox\./g, "Coordonnées bancaires fournisseur."],
  [/Données bancaires fictives — sandbox\. Aucune coordonnée bancaire réelle ne doit être saisie\./g, "Coordonnées bancaires du fournisseur."],
  [/Dernières factures fournisseurs — données fictives sandbox\./g, "Dernières factures fournisseurs."],
  [/Aucun email réel ne sera transmis — simulation sandbox\./g, "L'email sera envoyé selon votre configuration."],
  [/Inclure un faux lien de paiement sandbox/g, "Inclure un lien de paiement"],
  [/Aucune pièce jointe\. Les fichiers sont simulés \(URL fictive\) dans la sandbox\./g, "Aucune pièce jointe."],
  [/Je confirme la modification de ce devis déjà envoyé \(sandbox\)\./g, "Je confirme la modification de ce devis déjà envoyé."],
  [/Cette écriture est validée et ne peut plus être modifiée dans la sandbox\./g, "Cette écriture est validée et ne peut plus être modifiée."],
  [/Cette synthèse TVA est indicative et issue de données sandbox\. Elle ne constitue pas une déclaration fiscale\./g, "Cette synthèse TVA est indicative. Elle ne constitue pas une déclaration fiscale."],
  [/Créer un compte sandbox/g, "Créer un compte"],
  [/Configuration sandbox — paramètres fictifs\./g, "Paramètres avancés de l'organisation."],
  [/Non destinés à un usage/g, "Personnalisez selon vos besoins"],
  [/https:\/\/sandbox\.local\/pay\//g, "https://pay.example.com/"],
  [/catalogue sandbox/g, "catalogue"],
  [/Écriture .* créée en sandbox\./g, (m) => m.replace(" en sandbox", "")],
  [/Placeholder sandbox — module paiements à venir/g, "Module paiements fournisseurs"],
  [/ — sandbox/g, ""],
  [/ \(sandbox\)/g, ""],
  [/sandbox\./g, ""],
  [/non encore disponible dans cette sandbox\./g, "non encore disponible."],
  [/Comptes du plan comptable sandbox/g, "Comptes du plan comptable"],
  [/Liste des documents sandbox/g, "Liste des documents"],
  [/Reçu sandbox/g, "Reçu de paiement"],
  [/indicatif sandbox/g, "indicatif"],
  [/Reçu de paiement sandbox généré/g, "Reçu de paiement généré"],
  [/Facture validée — modification directe désactivée dans la sandbox\./g, "Facture validée — modification directe désactivée."],
  [/Réinitialisation sandbox simulée — aucune donnée réelle supprimée\./g, ""],
  [/Simuler une réinitialisation sandbox/g, ""],
  [/Configuration sandbox/g, "Configuration"],
  [/Environnement sandbox/g, "Maintenance système"],
  [/Reset et environnement/g, "Maintenance"],
  [/Système sandbox/g, "Système"],
  [/title: "Sandbox"/g, 'title: "Maintenance"'],
  [/description: "Reset et environnement"/g, 'description: "Maintenance système"'],
  [/href: "\/settings\/sandbox"/g, 'href: "/settings"'],
  [/Paiement fournisseur \(sandbox\)/g, "Paiement fournisseur"],
  [/Facture fournisseur marquée payée \(sandbox\)/g, "Facture fournisseur marquée payée"],
  [/tableau-de-bord-sandbox\.csv/g, "tableau-de-bord.csv"],
  [/Seeding sandbox database/g, "Seeding database"],
  [/🌱 Seeding sandbox database\.\.\./g, "🌱 Seeding database..."],
];

const lineRemovals = [
  /^\s*<Badge variant="warning">Sandbox<\/Badge>\s*$/,
  /^\s*<SettingsSandboxAlert\s*\/?>\s*$/,
  /^\s*<AccountingSandboxAlert\s*\/?>\s*$/,
  /^\s*<SandboxDocumentBadge\s*\/?>\s*$/,
  /^\s*import \{ SettingsSandboxAlert \} from "@\/components\/settings\/settings-sandbox-alert";\s*$/,
  /^\s*import \{ AccountingSandboxAlert(?:,\s*)?|\s*, AccountingSandboxAlert\s*\} from "@\/components\/accounting\/accounting-badges";\s*$/,
  /^\s*import \{ SandboxDocumentBadge \} from "@\/components\/documents\/sandbox-document-badge";\s*$/,
  /^\s*AccountingSandboxAlert,\s*$/,
];

for (const file of walk(ROOT)) {
  if (file.includes("migrate-to-production")) continue;
  if (file.includes("sandbox-settings-client")) continue;
  if (file.includes("settings-sandbox-alert")) continue;
  if (file.includes("sandbox-document-badge")) continue;
  if (file.includes("settings/sandbox/page")) continue;

  let content = fs.readFileSync(file, "utf8");
  const original = content;

  for (const [from, to] of replacements) {
    content = content.replace(from, to);
  }

  const lines = content.split("\n");
  content = lines.filter((line) => !lineRemovals.some((re) => re.test(line))).join("\n");

  content = content.replace(
    /import \{([^}]*)\} from "@\/components\/accounting\/accounting-badges";/g,
    (match, imports) => {
      const cleaned = imports
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && s !== "AccountingSandboxAlert")
        .join(", ");
      return cleaned ? `import { ${cleaned} } from "@/components/accounting/accounting-badges";` : "";
    },
  );

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log("updated:", path.relative(ROOT, file));
  }
}

console.log("Done.");
