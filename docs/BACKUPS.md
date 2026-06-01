# Sauvegardes et restauration

## Base de données (PostgreSQL)

### Neon (recommandé)

| Paramètre | Recommandation |
|-----------|----------------|
| **Fréquence** | Continu (PITR) + snapshots quotidiens (plan payant) |
| **Rétention** | 7–30 jours selon plan |
| **Staging** | Branche ou projet séparé ; snapshots indépendants |

### Procédure de sauvegarde manuelle

```bash
pg_dump "$DATABASE_URL" --format=custom --file=backup-$(date +%Y%m%d).dump
```

Stocker le fichier hors du poste développeur (S3 chiffré, coffre ops).

### Restauration

```bash
# Sur une base vide ou de récupération
pg_restore --clean --if-exists -d "$DATABASE_URL" backup-YYYYMMDD.dump
```

Puis `npm run db:migrate:status` et redéployer l'application compatible.

> **Production** : préférer la restauration **Point-in-Time** du fournisseur plutôt qu'un dump manuel ancien.

---

## Documents (R2 / S3)

| Paramètre | Recommandation |
|-----------|----------------|
| **Versioning** | Activer sur le bucket production |
| **Réplication** | Option multi-région si exigence client |
| **Inventaire** | Les métadonnées sont en PostgreSQL (`storageKey`) |

### Sauvegarde

- **R2** : règles de lifecycle + export périodique vers un second bucket `nova-gestion-backups`
- Fréquence suggérée : **quotidienne** pour PME SaaS

### Restauration

1. Restaurer les objets dans le bucket (ou pointer `S3_BUCKET` vers le bucket de secours).
2. Vérifier cohérence : chaque `Document.storageKey` / `SupplierInvoiceAttachment.storageKey` doit exister.
3. Tester téléchargement via `/api/files/{id}`.

---

## Tests de restauration

Trimestriel (staging) :

1. Restaurer un snapshot Neon sur une branche jetable.
2. Pointer staging temporairement vers cette branche.
3. Valider login + PDF + un upload.

---

## Ce qui n'est pas sauvegardé par défaut

- Logs Vercel (rétention limitée) → exporter vers un SIEM si besoin
- Secrets → gérés par Vercel / coffre (1Password, etc.)
