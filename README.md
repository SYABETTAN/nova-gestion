# Nova Gestion (ESTHER)

Application de gestion commerciale et pré-comptabilité pour PME — **PostgreSQL**, sessions signées, migrations versionnées, tests unitaires (Vitest) et E2E (Playwright).

## Prérequis

- Node.js 20+
- Docker (PostgreSQL local)
- npm

## Démarrage local

### Option A — Docker (recommandé si Docker Desktop est installé)

```bash
cp .env.example .env
npm run docker:up
npm install
npm run db:migrate
npm run db:seed:dev
npm run dev
```

### Option B — PostgreSQL via Homebrew (sans Docker)

```bash
brew install postgresql@16
brew services start postgresql@16

# Créer la base (une seule fois)
/opt/homebrew/opt/postgresql@16/bin/psql postgres -c "CREATE ROLE esther WITH LOGIN PASSWORD 'esther' CREATEDB;" 2>/dev/null || true
/opt/homebrew/opt/postgresql@16/bin/psql postgres -c "CREATE DATABASE esther OWNER esther;" 2>/dev/null || true

cp .env.example .env
npm install
npm run db:migrate
npm run db:seed:dev
npm run dev
```

> **Important :** exécutez les commandes **une par une**, sans commentaires `#` en fin de ligne lors du copier-coller.

Ouvrir [http://localhost:3000](http://localhost:3000).

### Comptes de développement (SEED_DEV_DATA=true)

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Propriétaire | owner@dev.local | DevSample123! |
| Admin | admin@dev.local | DevSample123! |
| Comptable | accountant@dev.local | DevSample123! |
| Commercial | sales@dev.local | DevSample123! |
| Lecture seule | readonly@dev.local | DevSample123! |

La connexion rapide développeur sur `/login` nécessite `ENABLE_DEV_LOGIN=true` (désactivé en production).

### Inscription et onboarding

| Environnement | Comportement par défaut |
|---------------|-------------------------|
| **Développement** | `REGISTRATION_MODE=open_dev` — `/register` ouvert pour créer org + OWNER |
| **Tests (Vitest)** | `open_dev` — flow testable automatiquement, aucun email réel |
| **Production** | `invite_only` — `/register` fermé ; pas de création OWNER publique |

**Rejoindre une organisation existante** : invitations équipe (`/accept-invitation/{token}`), indépendantes du mode d'inscription.

#### Variables d'inscription

| Variable | Valeurs | Description |
|----------|---------|-------------|
| `REGISTRATION_MODE` | `closed` \| `invite_only` \| `email_verification` \| `open_dev` | Mode global |
| `ALLOW_PUBLIC_SIGNUP` | `true` / `false` | En production, `open_dev` exige `true` + avertissement console |
| `REQUIRE_EMAIL_VERIFICATION` | `true` / `false` | Non implémenté (refusé au démarrage en prod) |

#### Onboarder un premier client (production)

1. Déployer avec `REGISTRATION_MODE=invite_only` et `ALLOW_PUBLIC_SIGNUP=false` (défaut).
2. Créer l'organisation client via le script ops (contourne l'inscription publique) :

```bash
npm run org:create -- \
  --name "Acme SAS" \
  --email "owner@client.fr" \
  --password "MotDePasseSecurise123!"
```

3. Communiquer les identifiants au client — connexion via `/login`.
4. Le client invite son équipe depuis **Paramètres → Équipe**.

> **Limites actuelles :** pas de vérification email à l'inscription ; pas de portail admin d'activation. L'onboarding initial repose sur le script ops ou une invitation équipe.

### Stockage documentaire

Documents, pièces jointes fournisseur et PDF générés sont stockés via `StorageProvider` (local en dev, S3/R2 en production). Téléchargement uniquement via `/api/files/*` (session + permissions).

Voir [docs/STORAGE.md](docs/STORAGE.md) pour la configuration (`STORAGE_PROVIDER`, `STORAGE_PATH`, `S3_*`).

#### Tests inscription

```bash
npm test -- tests/registration.test.ts
```

## Environnements

| Variable | Local | Staging | Production |
|----------|-------|---------|------------|
| `APP_ENV` | `development` | `staging` | `production` |
| `DATABASE_URL` | Postgres Docker | Postgres managé (Neon, Supabase, RDS) | Idem + SSL |
| `SESSION_SECRET` | défaut dev | secret fort unique | secret fort unique |
| `SEED_DEV_DATA` | `true` (optionnel) | `false` | `false` |
| `ENABLE_DEV_LOGIN` | `true` (optionnel) | `false` | `false` |
| `REGISTRATION_MODE` | `open_dev` | `invite_only` recommandé | `invite_only` (défaut) |
| `ALLOW_PUBLIC_SIGNUP` | `false` | `false` | `false` |

Fichiers modèles : `.env.staging.example`, `.env.production.example`.

### Staging

1. Provisionner PostgreSQL (ex. Neon).
2. Copier `.env.staging.example` → variables sur l'hébergeur.
3. `npm run db:migrate:deploy`
4. `npm run db:seed` (bootstrap rôles/permissions uniquement)
5. Déployer Next.js (Vercel, Railway, etc.) avec `APP_ENV=staging`.

### Production

1. `APP_ENV=production`, `SESSION_SECRET` ≥ 32 caractères (jamais la valeur dev).
2. `SEED_DEV_DATA=false`, `ENABLE_DEV_LOGIN=false`.
3. Migrations : `npm run db:migrate:deploy` en CI/CD avant ou au déploiement.
4. Sauvegardes PostgreSQL automatisées.
5. HTTPS obligatoire (cookies de session `secure` en production).

## Email transactionnel

Provider par défaut : **Resend** (`resend` npm). Les emails critiques (devis, factures, relances, reçus de paiement, invitations équipe) passent par `lib/email/send-email.ts`.

| Variable | Description |
|----------|-------------|
| `EMAIL_PROVIDER` | `log` (dev), `mock` (tests), `resend` (prod) |
| `EMAIL_FROM` | Expéditeur (obligatoire en production) |
| `EMAIL_REPLY_TO` | Adresse de réponse (optionnel) |
| `RESEND_API_KEY` | Clé API Resend (obligatoire si `EMAIL_PROVIDER=resend`) |

### Comportement par environnement

| Environnement | Comportement |
|---------------|--------------|
| **Développement** | Par défaut `EMAIL_PROVIDER=log` — l'email est journalisé dans la console, aucun envoi externe |
| **Tests (Vitest)** | Provider `mock` automatique — emails capturés en mémoire, aucun envoi réel |
| **Production** | `EMAIL_PROVIDER=resend` + `EMAIL_FROM` + `RESEND_API_KEY` requis — sinon l'action échoue avec un message clair |

### Configuration locale (journal)

```bash
# .env
EMAIL_PROVIDER=log
EMAIL_FROM="Nova Gestion <no-reply@localhost.dev>"
```

Lancez l'app (`npm run dev`), créez un devis/facture et envoyez : le contenu apparaît dans les logs serveur `[email:log]`.

### Configuration production (Resend)

1. Créez un compte sur [resend.com](https://resend.com) et vérifiez votre domaine.
2. Définissez les variables (voir `.env.production.example`).
3. Testez un envoi depuis l'interface (devis ou invitation équipe).

### Tester l'envoi email

```bash
# Tests unitaires email (mock, sans envoi réel)
npm test -- tests/email.test.ts

# Dev : observer les logs après envoi depuis l'UI
npm run dev
```

## Invitations équipe

Flow sécurisé pour ajouter des membres à une organisation existante (sans créer de compte propriétaire).

1. Un utilisateur avec la permission `MEMBERS_INVITE` envoie une invitation depuis **Paramètres → Équipe**.
2. Un token aléatoire (256 bits, `crypto.randomBytes`) est généré ; **seul son hash SHA-256** est stocké en base (`tokenHash`).
3. Un email transactionnel contient le lien `/accept-invitation/{token}` (validité : **7 jours** par défaut).
4. Le destinataire crée un compte ou confirme avec son mot de passe existant, puis rejoint l'organisation avec le rôle prévu.

| Statut invitation | Signification |
|-------------------|---------------|
| `PENDING` | En attente d'acceptation |
| `ACCEPTED` | Utilisée (non réutilisable) |
| `EXPIRED` | Date dépassée |
| `REVOKED` | Annulée par un administrateur |

### Permissions

- Seuls les rôles avec `MEMBERS_INVITE` peuvent inviter (OWNER, ADMIN).
- Un non-OWNER ne peut pas inviter un OWNER.
- On ne peut pas attribuer un rôle supérieur au sien.

### Tester les invitations

```bash
npm test -- tests/invitations.test.ts
npm run dev
# Paramètres → Équipe → Inviter — vérifier le log [email:log] avec le lien
```

## Authentification et sessions

Sessions signées **HMAC-SHA256** avec expiration embarquée (format `v2.{userId}.{issuedAt}.{signature}`).

| Composant | Rôle |
|-----------|------|
| `middleware.ts` | Valide signature + expiration avant routes privées |
| `lib/session.ts` | Création / validation / options cookie |
| `lib/middleware-auth.ts` | Règles publiques / privées (testable) |
| `lib/auth.ts` | Login, logout, `requireAuth`, membership ACTIVE |
| `lib/tenant-scope.ts` | Garde-fous multi-tenant |

### Routes

| Type | Chemins |
|------|---------|
| **Publiques** | `/login`, `/register`, `/accept-invitation/*` |
| **Privées** | Tout le reste (dashboard, devis, factures, etc.) |
| **Auth-only** | `/login`, `/register` → redirigent vers `/dashboard` si session valide |

### Cookie `esther_session`

- `httpOnly: true`
- `sameSite: lax`
- `secure: true` en production (`NODE_ENV=production`)
- Durée : **7 jours**
- Cookie invalide / expiré → **supprimé** + redirection `/login`

### Variables requises

| Variable | Production |
|----------|------------|
| `SESSION_SECRET` | Obligatoire, ≥ 32 caractères, jamais la valeur dev |

### Tests sécurité

```bash
npm test -- tests/session.test.ts tests/middleware-auth.test.ts tests/auth-security.test.ts
```

## Tests

```bash
# Unitaires (nécessite Postgres + seed dev)
npm run db:seed:dev
npm test

# E2E (démarre le serveur dev si absent)
ENABLE_DEV_LOGIN=true npm run test:e2e
```

## Scripts utiles

| Script | Description |
|--------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production |
| `npm run db:migrate` | Migration dev |
| `npm run db:migrate:deploy` | Migration staging/prod |
| `npm run db:seed` | Bootstrap (rôles/permissions) |
| `npm run db:seed:production` | Bootstrap sans fixtures (staging/prod) |
| `npm run db:seed:dev` | Bootstrap + fixtures |
| `npm run typecheck` | Vérification TypeScript |
| `npm run ci` | Pipeline qualité complet |
| `npm run predeploy:verify` | Vérifications pré-déploiement |
| `npm run org:create` | Créer org client + OWNER (ops, hors /register) |
| `npm run test:e2e` | Playwright |

## Montants financiers (Decimal)

Tous les montants métier critiques sont stockés en **PostgreSQL `DECIMAL(19,4)`** via Prisma `Decimal`, et calculés avec **Decimal.js** (`lib/money.ts`).

### Stratégie

| Couche | Approche |
|--------|----------|
| **Base de données** | `Decimal @db.Decimal(19,4)` — pas de `Float` |
| **Calculs métier** | Decimal.js de bout en bout (`moneyAdd`, `calculateVatAmount`, etc.) |
| **Écriture Prisma** | `toDbDecimal()` / `mapMoneyFieldsToDb()` |
| **Affichage UI** | `formatCurrency()` / `moneyToNumber()` au dernier moment |
| **Lecture Prisma** | Extension client → conversion automatique en `number` pour l'UI |

### Règles d'arrondi

- **Centimes (affichage)** : 2 décimales, arrondi half-up (`MONEY_SCALE = 2`)
- **Stockage intermédiaire** : 4 décimales en base (`DB_MONEY_SCALE = 4`)
- **TVA** : calcul ligne par ligne, puis agrégation — pas de `parseFloat` ni d'arithmétique IEEE float

### Bonnes pratiques développement

```typescript
import { money, moneyAdd, calculateVatAmount, toDbDecimal, moneyToNumber } from "@/lib/money";
import { calculateInvoiceTotals } from "@/lib/invoice-calculations";

// Calcul
const totals = calculateInvoiceTotals({ ... });

// Écriture DB
await prisma.invoice.create({
  data: {
    totalIncludingTax: toDbDecimal(totals.totalIncludingTax),
  },
});

// Affichage
formatCurrency(invoice.totalIncludingTax);
```

### Migration

```bash
npm run db:migrate:deploy   # applique 20250529160000_financial_decimal
```

### Tests

```bash
npm test -- tests/money-calculations.test.ts tests/quote-calculations.test.ts tests/payment-calculations.test.ts
```

### Limites connues

- Les pourcentages (TVA, marge) partagent le même type `DECIMAL(19,4)` — suffisant pour un PME SaaS
- `moneyToNumber()` produit un `number` JavaScript réservé à l'affichage — ne pas l'utiliser dans des calculs intermédiaires
- Les graphiques Recharts consomment des `number` convertis au rendu

## Architecture données

- **PostgreSQL** via Prisma (migrations dans `prisma/migrations/`)
- **Montants financiers** : `DECIMAL(19,4)` + Decimal.js (voir section ci-dessus)
- Sessions **signées HMAC** (`SESSION_SECRET`)
- Audit : `USER_LOGIN`, `USER_LOGOUT`, actions métier
- Exports JSON : métadonnées `environment`, masquage IBAN/mots de passe

## Déploiement et infrastructure (Étape 9)

Architecture cible : **Vercel** (app) + **Neon** (PostgreSQL) + **Cloudflare R2** (fichiers) + **Resend** (email).

| Document | Contenu |
|----------|---------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Staging, production, checklists, rollback |
| [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md) | Toutes les variables d'environnement |
| [docs/BACKUPS.md](docs/BACKUPS.md) | Sauvegarde / restauration base et fichiers |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Incidents (DB, email, stockage, migrations) |
| [docs/MONITORING.md](docs/MONITORING.md) | Health check, Sentry |
| [docs/LOGGING.md](docs/LOGGING.md) | Logs structurés |

### Commandes clés

```bash
npm run ci                  # lint + typecheck + tests + build (identique à la CI)
npm run predeploy:verify    # contrôles avant staging/prod (avec variables cibles)
npm run db:migrate:deploy   # migrations staging/prod uniquement
curl https://app.../api/health
```

**CI** : GitHub Actions (`.github/workflows/ci.yml`) sur chaque PR/push.

**Docker** (optionnel) : `Dockerfile` pour Render/Railway/VPS.

SQLite n'est plus supporté (incompatible serverless et production multi-instances).
