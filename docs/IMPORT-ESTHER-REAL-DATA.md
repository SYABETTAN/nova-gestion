# Données réelles Esther

Import idempotent des clients, fournisseurs, produits et PDF issus des documents comptables.

## Commande

```bash
npm run import:esther-real-data
```

Variables utiles :

| Variable | Description |
|----------|-------------|
| `ORGANIZATION_ID` | ID organisation cible (prioritaire) |
| `ORGANIZATION_SLUG` | Slug organisation (défaut : `nova-gestion`) |
| `ESTHER_REAL_DATA_DIR` | Dossier contenant `pdfs/` (défaut : `data/esther-real`) |

Options CLI :

```bash
npm run import:esther-real-data -- --dry-run
npm run import:esther-real-data -- --org-slug nova-gestion
npm run import:esther-real-data -- --data-dir /chemin/vers/dossier
```

## Fichiers PDF attendus

Placer les PDF dans `data/esther-real/pdfs/` :

- `kbis-talidress-levalois.pdf`
- `kbis-zacko-romy.pdf`
- `facture-msi-fa37374.pdf`

## Idempotence

Relancer la commande ne crée pas de doublons :

- **Clients** : SIRET / SIREN / nom + organisation
- **Fournisseurs** : TVA / SIRET / nom + organisation
- **Produits** : SKU + organisation
- **Documents** : checksum SHA-256 + nom fichier + organisation
- **Factures fournisseur** : numéro facture + fournisseur + organisation

## Données incertaines

- **SAS SIMHA EMOI** : SIREN/SIRET absents du PDF MSI
- **AVITEX FA20260053** : métadonnées préparées, facture ignorée tant que le PDF n'est pas fourni
- **JPE26 / GSR26** : références sans prix d'achat documenté

## Tests

```bash
npm test -- tests/esther-real-data-import.test.ts
```
