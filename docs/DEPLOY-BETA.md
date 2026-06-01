# Déployer en bêta

> **Mode bêta** : les checks stricts (lint, typecheck, tests, CI automatique) sont désactivés pour accélérer les hotfix. **À réactiver avant une production stable.**

Objectif : push → Vercel build → URL accessible, le plus vite possible.

---

## Flow minimal (3 étapes)

### 1. Commit

```bash
git add .
git commit -m "fix: description du correctif"
```

**Email Git** (évite le rejet Vercel) :

```bash
git config --local user.email "203708253+SYABETTAN@users.noreply.github.com"
```

### 2. Push sur GitHub

```bash
git push origin main
```

Vercel détecte le push et lance le build automatiquement.

### 3. Vérifier l’URL

- Dashboard Vercel : [vercel.com/dashboard](https://vercel.com/dashboard)
- Production : **https://nova-gestion-eight.vercel.app** (ou l’URL de votre projet)

---

## Ce que fait Vercel au build

| Étape | Script | Obligatoire |
|-------|--------|-------------|
| Install | `npm ci` | Oui |
| Prisma client | `postinstall` → `prisma generate` | Oui |
| Build | `vercel-build` → `prisma generate && next build` | Oui |
| Migrations | **Manuel** (voir ci-dessous) | Si schéma modifié |

**Interdit en production** : `prisma db push`, `prisma migrate reset`.

---

## Migrations (manuel, après changement de schéma)

Les migrations ne bloquent plus le build Vercel. Lancez-les **après** un déploiement qui inclut de nouvelles migrations Prisma.

### Option A — en local (Neon)

```bash
export DATABASE_URL="postgresql://..."   # URL Neon production
npm run db:migrate:deploy
```

### Option B — GitHub Actions (manuel)

1. GitHub → **Actions** → **Deploy migrations**
2. **Run workflow** → choisir `production`
3. Secret requis : `DATABASE_URL_PRODUCTION`

---

## Variables Vercel indispensables

Configurer dans **Settings → Environment Variables** (Production) :

| Variable | Exemple / note |
|----------|----------------|
| `DATABASE_URL` | URL Neon (pooled) |
| `SESSION_SECRET` | `openssl rand -hex 32` (≥ 32 car.) |
| `APP_ENV` | `production` |
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `NEXT_PUBLIC_APP_NAME` | `Nova Gestion` |
| `NEXT_PUBLIC_APP_URL` | `https://votre-projet.vercel.app` |
| `SEED_DEV_DATA` | `false` |
| `ENABLE_DEV_LOGIN` | `false` |
| `REGISTRATION_MODE` | `invite_only` ou `open_dev` (démo) |
| `EMAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | clé Resend |
| `EMAIL_FROM` | `Nova Gestion <onboarding@resend.dev>` |
| `STORAGE_PROVIDER` | `local` |
| `STORAGE_PATH` | `/tmp/uploads` |

Référence complète : `.env.vercel.example`

**Build Command Vercel** : `npm run vercel-build` (ou laisser vide si Vercel détecte Next.js et utilise ce script).

---

## Checklist post-déploiement

- [ ] App accessible (`https://…vercel.app`)
- [ ] `/api/health` → `"status":"healthy"`
- [ ] Login fonctionne
- [ ] Dashboard s’affiche sans erreur
- [ ] Base connectée (pas d’erreur 500 au chargement)
- [ ] Création d’un client fonctionne
- [ ] Aucune erreur critique visible (console / écran)

---

## Commandes utiles (local, non bloquantes)

```bash
npm run dev              # développement
npm run build            # build Next.js seul
npm run ci               # build seul (équivalent déploiement bêta)
npm run ci:strict        # lint + typecheck + tests + build (avant prod stable)
npm run lint             # optionnel
npm run typecheck        # optionnel
npm test                 # optionnel
npm run predeploy:verify # optionnel, avant prod
```

---

## Dépannage rapide

| Problème | Action |
|----------|--------|
| Build Vercel échoue (Prisma) | Vérifier `DATABASE_URL` présente ; `postinstall` génère le client |
| Build échoue (ESLint/TS) | Mode bêta : ignorés sur Vercel ; sinon `BETA_FAST_DEPLOY=true npm run build` |
| 500 au login | `SESSION_SECRET` ≥ 32 caractères |
| Schéma DB obsolète | `npm run db:migrate:deploy` manuellement |
| Vercel « not a member of the team » | Email Git GitHub sur les commits (voir étape 1) |
| CI rouge sur GitHub | Normal en bêta — CI n’est plus déclenchée au push ; lancer manuellement si besoin |

---

## Réactiver les checks stricts (avant prod stable)

1. `next.config.ts` — retirer ou conditionner `eslint.ignoreDuringBuilds` / `typescript.ignoreBuildErrors`
2. `.github/workflows/ci.yml` — remettre `on: push` / `pull_request`
3. `package.json` — `vercel-build` peut inclure `prisma migrate deploy` si souhaité
4. Branch protection GitHub — exiger CI verte avant merge

Voir aussi : [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md), [DEPLOYMENT.md](./DEPLOYMENT.md)
