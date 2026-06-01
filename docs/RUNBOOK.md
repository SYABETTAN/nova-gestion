# Runbook — reprise après incident

## 1. Base de données inaccessible

**Symptômes** : `/api/health` → `database: error`, 503, erreurs Prisma.

**Diagnostic**

1. Vérifier statut Neon / fournisseur Postgres.
2. Tester : `psql "$DATABASE_URL" -c 'SELECT 1'`
3. Vérifier quotas, IP allowlist, expiration mot de passe.

**Résolution**

- Incident fournisseur → attendre ou basculer sur réplica / restore PITR.
- URL incorrecte → corriger `DATABASE_URL` sur Vercel, redéployer.

**Rollback app** : inutile si la base seule est en cause.

---

## 2. Email indisponible

**Symptômes** : envoi devis/facture/invitation échoue, message « email non configuré ».

**Diagnostic**

1. Variables : `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`
2. Dashboard Resend : quota, domaine, bounces.
3. Logs : `[email]` ou JSON `area: email`

**Résolution**

- Clé expirée → régénérer `RESEND_API_KEY`
- Domaine non vérifié → finaliser DNS Resend
- Provider down → communiquer aux clients, file d'attente manuelle temporaire

---

## 3. Bucket / stockage indisponible

**Symptômes** : upload échoue, PDF généré mais non téléchargeable, 404 sur `/api/files`.

**Diagnostic**

1. Variables `S3_*`, permissions clés R2
2. Logs `[storage]` ou erreurs AWS SDK
3. Tester `aws s3 ls` avec les mêmes credentials (endpoint R2)

**Résolution**

- Credentials → régénérer clés, mettre à jour Vercel
- Bucket supprimé → restaurer depuis backup bucket
- Quota → augmenter plan Cloudflare

---

## 4. Build cassé

**Symptômes** : CI rouge, déploiement Vercel failed.

**Diagnostic**

1. GitHub Actions → logs `ci.yml`
2. En local : `npm run ci`

**Résolution**

- Corriger le commit, repousser
- Rollback Vercel vers déploiement précédent (section rollback [DEPLOYMENT.md](./DEPLOYMENT.md))

---

## 5. Migration échouée

**Symptômes** : `prisma migrate deploy` failed en CI ou build.

**Diagnostic**

```bash
DATABASE_URL="..." npm run db:migrate:status
```

**Résolution**

1. **Ne pas** `db reset` en production.
2. Corriger la migration SQL en dev, nouvelle migration corrective.
3. Si base partiellement migrée : intervention manuelle SQL + marquer migration résolue (`prisma migrate resolve`).
4. En dernier recours : restore snapshot Neon **avant** la migration, corriger, redéployer.

---

## Contacts & escalade

| Niveau | Action |
|--------|--------|
| P1 | App inaccessible clients → restore + communicate |
| P2 | Fonction dégradée (email seul) → workaround + fix < 24h |
| P3 | Bug non bloquant → ticket + prochain déploiement |

Documenter chaque incident : heure, cause, actions, prévention.
