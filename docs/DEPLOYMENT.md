# Guide de déploiement — Nova Gestion

> **Mode bêta actif** : pour les hotfix fréquents, utiliser [DEPLOY-BETA.md](./DEPLOY-BETA.md). Les checks CI stricts sont désactivés au push.

## Architecture retenue

| Composant | Service | Justification |
|-----------|---------|---------------|
| **Application** | [Vercel](https://vercel.com) | Next.js 15, server actions, déploiement Git natif |
| **Base de données** | [Neon](https://neon.tech) | PostgreSQL managé, branches staging, sauvegardes |
| **Stockage fichiers** | [Cloudflare R2](https://www.cloudflare.com/r2/) | Compatible S3, coût faible, déjà intégré |
| **Email** | [Resend](https://resend.com) | Déjà intégré, domaine vérifiable |
| **Monitoring** | Sentry (optionnel) | `SENTRY_DSN` + `@sentry/nextjs` |
| **CI** | GitHub Actions (manuel en bêta) | `.github/workflows/ci.yml` |

**Alternative tout-en-un** : Render ou Railway (app Docker + Postgres) — voir `Dockerfile`.

Aucun tunnel Cloudflare ni Mac local requis en exploitation.

---

## Environnements

| | Développement | Staging | Production |
|---|---------------|---------|------------|
| **But** | Développeur | Préprod réaliste | Clients payants |
| **APP_ENV** | `development` | `staging` | `production` |
| **Base** | Docker local | Neon `esther_staging` | Neon `esther` |
| **Stockage** | `./uploads` | Bucket staging | Bucket prod |
| **Inscription** | `open_dev` | `invite_only` | `invite_only` |
| **Seed démo** | autorisé | interdit | interdit |

---

## Prérequis exacts

### Comptes & services

1. Dépôt Git (GitHub recommandé pour CI)
2. Projet Vercel lié au dépôt
3. Projet Neon : 2 bases (staging + production) ou 2 branches
4. Bucket R2 (×2) + clés API
5. Domaine + DNS (staging + app)
6. Compte Resend + domaine vérifié
7. (Optionnel) Projet Sentry

### Secrets à configurer sur Vercel

Copier depuis `.env.staging.example` ou `.env.production.example` — voir [ENVIRONMENT.md](./ENVIRONMENT.md).

Minimum production :

- `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`
- `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`
- `STORAGE_PROVIDER=s3` + `S3_*`
- `APP_ENV=production`, `SEED_DEV_DATA=false`, `ENABLE_DEV_LOGIN=false`

---

## Checklist avant mise en ligne

- [ ] Build OK (`npm run ci` ou build Vercel vert)
- [ ] `npm run ci:strict` + `npm run predeploy:verify` (avant prod stable)
- [ ] Migrations testées sur clone staging : `npm run db:migrate:deploy`
- [ ] `npm run db:seed:production` (rôles/permissions uniquement)
- [ ] Premier client : `npm run org:create` (pas `/register` en prod)
- [ ] Resend : domaine vérifié, email test envoyé
- [ ] R2 : upload + téléchargement PDF testés
- [ ] `/api/health` retourne `200` et `database: ok`
- [ ] HTTPS actif, cookies session OK
- [ ] Sauvegardes Neon activées (voir [BACKUPS.md](./BACKUPS.md))

---

## Déployer le staging

1. **Neon** : créer base `esther_staging`, copier `DATABASE_URL`.
2. **Vercel** : projet → Settings → Environment Variables → scope **Preview** ou branche `staging`.
3. Renseigner variables depuis `.env.staging.example`.
4. **Migrations** (une fois ou via CI) :
   ```bash
   DATABASE_URL="..." npm run db:migrate:deploy
   DATABASE_URL="..." npm run db:seed:production
   ```
5. Déployer la branche `staging` (push ou PR preview).
6. Vérifier `https://staging.../api/health`.
7. Tests manuels : login, devis, PDF, upload PJ, invitation.

---

## Déployer la production

1. Variables scope **Production** sur Vercel (jamais les secrets staging).
2. **Migrations** avant ou pendant le déploiement :
   ```bash
   # En local avec URL prod (ou GitHub Actions → Deploy migrations)
   DATABASE_URL="..." npm run db:migrate:deploy
   ```
   **Interdit** : `db push`, `db reset`, `migrate dev` sur la base prod.
3. Bootstrap si nouvelle base :
   ```bash
   DATABASE_URL="..." npm run db:seed:production
   ```
4. Déployer `main` sur Vercel.
5. Checklist après déploiement (ci-dessous).

### Build Vercel recommandé

| Setting | Valeur |
|---------|--------|
| Build Command | `prisma generate && prisma migrate deploy && next build` |
| Install Command | `npm ci` |
| Node | 20.x |

> Exécuter les migrations dans le build uniquement si une seule instance déploie à la fois. Sinon : workflow `deploy-migrations.yml` en amont.

---

## Checklist après déploiement

- [ ] `/api/health` → `healthy`
- [ ] Connexion utilisateur ops
- [ ] Création devis + PDF + email log/Resend
- [ ] Upload document
- [ ] Invitation équipe
- [ ] Logs structurés visibles (Vercel → Logs)
- [ ] (Si Sentry) erreur test capturée

---

## Procédure rollback

### Application (Vercel)

1. Deployments → déploiement précédent stable → **Promote to Production**.
2. Vérifier `/api/health`.

### Migrations Prisma

- Prisma **ne rollback pas** automatiquement une migration appliquée.
- Préparer un script SQL de rollback manuel pour migrations risquées.
- En urgence : restaurer un **snapshot Neon** (voir [BACKUPS.md](./BACKUPS.md)) puis redéployer une version app compatible.

### Données

- Restauration base + bucket selon [BACKUPS.md](./BACKUPS.md).

---

## Scripts npm

| Script | Usage |
|--------|--------|
| `npm run ci` | Lint + typecheck + tests + build |
| `npm run predeploy:verify` | Contrôles pré-déploiement |
| `npm run db:migrate:deploy` | Migrations staging/prod |
| `npm run db:migrate:status` | État des migrations |
| `npm run db:seed:production` | Bootstrap sans fixtures |
| `npm run org:create` | Premier client OWNER |

---

## Docker (optionnel)

```bash
docker build -t nova-gestion .
docker run -p 3000:3000 --env-file .env.production nova-gestion
```

Migrations en job séparé avant le démarrage du conteneur.

---

## Puis-je déployer ?

| Question | Réponse |
|----------|---------|
| **Staging ?** | **Oui**, après provision Neon staging + variables Vercel Preview + migrations. |
| **Production ?** | **Oui**, après checklist complète, secrets prod, Resend/R2 configurés, premier client via `org:create`. |
