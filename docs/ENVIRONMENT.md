# Variables d'environnement

Référence complète. **Ne jamais committer** `.env`, `.env.local`, ni les secrets.

| Fichier modèle | Usage |
|----------------|--------|
| `.env.development.example` | Copie locale → `.env` |
| `.env.staging.example` | Variables hébergeur staging |
| `.env.production.example` | Variables hébergeur production |

## Environnement

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `APP_ENV` | Oui | `development` \| `staging` \| `production` |
| `NEXT_PUBLIC_APP_ENV` | Oui | Miroir public pour l'UI |
| `NODE_ENV` | Auto | `development` ou `production` (build) |

## Base de données

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `DATABASE_URL` | Oui | URL PostgreSQL (`sslmode=require` en cloud) |

## Authentification

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `SESSION_SECRET` | Oui | ≥ 32 caractères ; unique par environnement |

## Application

| Variable | Obligatoire | Description |
|----------|-------------|-------------|
| `NEXT_PUBLIC_APP_NAME` | Non | Nom affiché |
| `NEXT_PUBLIC_APP_URL` | Staging/Prod | URL canonique HTTPS |

## Inscription

| Variable | Défaut prod | Description |
|----------|-------------|-------------|
| `REGISTRATION_MODE` | `invite_only` | `closed` \| `invite_only` \| `open_dev` |
| `ALLOW_PUBLIC_SIGNUP` | `false` | `open_dev` + prod : onboarding temporaire uniquement |
| `REQUIRE_EMAIL_VERIFICATION` | — | Non implémenté (refusé au boot prod) |

## Développement (interdit staging/prod)

| Variable | Description |
|----------|-------------|
| `SEED_DEV_DATA` | Fixtures démo (`npm run db:seed:dev`) |
| `ENABLE_DEV_LOGIN` | Connexion rapide `/login` |
| `NEXT_PUBLIC_ENABLE_DEV_LOGIN` | Affichage UI dev login |

## Email

| Variable | Prod | Description |
|----------|------|-------------|
| `EMAIL_PROVIDER` | `resend` | `log` \| `mock` \| `resend` |
| `EMAIL_FROM` | Oui | Expéditeur |
| `EMAIL_REPLY_TO` | Non | Réponse |
| `RESEND_API_KEY` | Si resend | Clé API |

## Stockage

| Variable | Prod | Description |
|----------|------|-------------|
| `STORAGE_PROVIDER` | `s3` | `local` \| `s3` |
| `STORAGE_PATH` | — | Répertoire si `local` |
| `S3_ENDPOINT` | R2/S3 | URL API compatible S3 |
| `S3_REGION` | Oui | `auto` pour R2 |
| `S3_BUCKET` | Oui | Bucket dédié par env |
| `S3_ACCESS_KEY` | Oui | Clé |
| `S3_SECRET_KEY` | Oui | Secret |

Voir [STORAGE.md](./STORAGE.md).

## Observabilité

| Variable | Description |
|----------|-------------|
| `LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` |
| `SENTRY_DSN` | DSN Sentry (optionnel ; `npm i @sentry/nextjs`) |

## Séparation staging / production

- Bases PostgreSQL **distinctes** (`esther_staging` vs `esther`)
- Buckets R2/S3 **distincts**
- `SESSION_SECRET` **distincts**
- Domaines **distincts**
- Projets Sentry : environnements `staging` et `production`
