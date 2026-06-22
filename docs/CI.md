# CI/CD — Joey & Joey

## Objectif

Aucune version n'est livrable si la pipeline échoue. Chaque PR et push sur `main`, `master` ou `develop` déclenche la CI GitHub Actions.

## Workflows

| Fichier | Rôle |
|---------|------|
| `.github/workflows/ci.yml` | Pipeline principale (qualité + E2E smoke) |
| `.github/workflows/deploy-migrations.yml` | Migrations manuelles staging/prod (étape 9) |

## Pipeline (ordre)

### Job `quality` (~8–15 min)

1. `npm ci`
2. `prisma validate`
3. `prisma generate`
4. `prisma migrate deploy`
5. `npm run db:seed:production` (rôles/permissions uniquement)
6. Vérification `prisma migrate status` (échec si migrations en attente)
7. `npm run lint` — **bloquant**
8. `npm run typecheck` — **bloquant**
9. `npm test` — **bloquant** (`SEED_DEV_DATA=false`)
10. `npm run build` — **bloquant**

### Job `e2e-smoke` (~10–20 min, après `quality`)

1. Postgres dédié `esther_e2e`
2. Migrations + `db:seed:production` + `db:seed:ci-e2e`
3. `npm run build`
4. `playwright test --project=smoke`

**Parcours smoke** : routes protégées, login/logout, création client, accès devis, `/api/health`.

### Job `env-examples` (push `main` uniquement)

Vérifie la présence des fichiers `.env*.example`.

## Quality gates (bloquants)

| Gate | Commande |
|------|----------|
| Schéma Prisma | `prisma validate` |
| Migrations | `prisma migrate deploy` + status |
| Lint | `npm run lint` |
| Types | `npm run typecheck` |
| Tests | `npm test` |
| Build | `npm run build` |
| E2E smoke | `npm run test:e2e:smoke` |

Aucune étape n'utilise `prisma db push` ni `db reset`.

## Exécution locale

### Qualité (identique au job CI)

```bash
# PostgreSQL local (docker compose)
npm run docker:up

npm run ci:local
# ou étape par étape :
npm run ci:prisma
npm run ci:quality
```

### E2E smoke

```bash
export DATABASE_URL="postgresql://esther:esther@localhost:5432/esther?schema=public"
npx prisma migrate deploy
npm run db:seed:production
npm run db:seed:ci-e2e
npm run build
npm run test:e2e:smoke
```

Identifiants E2E : voir `lib/ci-test-credentials.ts`.

### Suite E2E complète (développement)

Nécessite `ENABLE_DEV_LOGIN=true` et `db:seed:dev` :

```bash
npm run db:seed:dev
ENABLE_DEV_LOGIN=true npm run test:e2e
```

## Procédure avant merge

1. Branche à jour avec `main`
2. `npm run ci:local` vert en local
3. Ouvrir une PR → attendre CI verte (quality + e2e-smoke)
4. Revue code
5. Merge uniquement si tous les checks sont verts

## Procédure avant release

1. CI verte sur `main`
2. [DEPLOYMENT.md](./DEPLOYMENT.md) — checklist staging puis production
3. `npm run predeploy:verify` avec variables cibles
4. Migrations : workflow `Deploy migrations` ou manuel
5. Tag / release notes

## CD (futur, non automatisé)

| Environnement | Déclencheur suggéré | Automatisation |
|---------------|---------------------|----------------|
| Staging | Merge `develop` → deploy Vercel Preview | Manuel documenté |
| Production | Tag `v*` + approbation | **Non auto** — promote Vercel |

Ne pas déployer en production sans CI verte sur le commit déployé.

## Tests et reproductibilité CI

| Avant | Après |
|-------|--------|
| `mvp-smoke` exigeait seed démo | Bootstrap CI sans fixtures ; tests démo `skip` si `SEED_DEV_DATA≠true` |
| `audit` exigeait `owner@dev.local` | Org éphémère créée dans le test |
| E2E dépendait du bouton dev login | Login email/mot de passe via `seed-ci-e2e` |
| Pas d'E2E en CI | Job `e2e-smoke` |

## Husky / pre-commit (optionnel)

Non installé par défaut (évite friction). Pour l'ajouter :

```bash
npm install -D husky lint-staged
npx husky init
# .husky/pre-commit : npx lint-staged
```

Recommandation : s'appuyer sur la CI GitHub comme gate principal.

## Simuler un échec CI

```bash
# TypeScript : introduire une erreur de type puis npm run typecheck
# Test : modifier un expect dans tests/money-calculations.test.ts
# Build : casser un import dans app/layout.tsx
```

Pousser la branche et vérifier que GitHub Actions échoue avec un message explicite.

## Durée indicative

| Job | Durée |
|-----|--------|
| quality | 8–15 min |
| e2e-smoke | 10–20 min |
| **Total PR** | **~20–35 min** |

## Limitations

- E2E complet (`project=full`) non exécuté en CI (nécessite seed démo)
- Pas de test de charge
- Pas de scan sécurité dépendances (à ajouter : Dependabot / npm audit)
