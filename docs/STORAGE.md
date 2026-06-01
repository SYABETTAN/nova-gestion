# Stockage documentaire (Étape 8)

Nova Gestion stocke les fichiers (pièces jointes, PDF générés, uploads) **hors base de données**, derrière une couche d’abstraction `StorageProvider`.

## Architecture

| Couche | Rôle |
|--------|------|
| `lib/storage/*` | Fournisseurs local / S3-compatible |
| `lib/documents/document-storage.ts` | CRUD métier + clés `storageKey` |
| `app/api/files/*` | Téléchargement authentifié (jamais d’URL publique bucket) |
| `lib/pdf/*` + `lib/documents/pdf-service.ts` | Génération PDF factures / devis |

Clé de stockage : `{organizationId}/{category}/{uuid}-{nom-sécurisé}.ext`

## Configuration locale

```env
STORAGE_PROVIDER=local
STORAGE_PATH=./uploads
```

Les fichiers sont écrits sous `STORAGE_PATH` (ignoré par git via `/uploads`).

## Configuration production (S3 / Cloudflare R2)

```env
STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=nova-gestion-files
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

Le bucket n’est **pas** exposé publiquement : seules les routes API `/api/files/{id}` et `/api/files/supplier-attachment/{id}` servent les fichiers après contrôle session + permission + `organizationId`.

## Quotas et validation

- Taille max : **15 Mo** par fichier
- Extensions autorisées : pdf, images courantes, csv, txt, doc/x, xls/x, zip
- Extensions bloquées : exe, js, html, svg, etc.
- Noms de fichiers assainis (pas de `..`, caractères dangereux)

## Sauvegarde

- **Local** : sauvegarder le répertoire `uploads/` avec la base PostgreSQL.
- **S3/R2** : activer le versioning / réplication côté provider ; la base ne contient que les métadonnées (`storageKey`, checksum).

## Bonnes pratiques

1. Ne jamais mettre de fichier binaire en base.
2. Ne jamais renvoyer d’URL directe vers le bucket.
3. Toujours vérifier `organizationId` avant lecture.
4. Préférer `uploadDocumentAction` / `uploadSupplierInvoiceAttachmentAction` pour les uploads UI.
