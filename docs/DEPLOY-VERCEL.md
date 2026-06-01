# Déploiement gratuit GitHub + Vercel

Guide pour obtenir une URL publique `https://votre-projet.vercel.app`.

## Stack

| Composant | Technologie |
|-----------|-------------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind 4 |
| Base | PostgreSQL + Prisma |
| Auth | Sessions signées (cookie) |
| Hébergement | **Vercel** (gratuit) |
| Base gratuite | **Neon** (PostgreSQL) |
| Email gratuit | **Resend** (100/jour) |
| Fichiers (optionnel) | Cloudflare R2 (gratuit) |

## Prérequis

- Compte [GitHub](https://github.com)
- Compte [Vercel](https://vercel.com) (connexion GitHub)
- Compte [Neon](https://neon.tech) (gratuit, sans carte pour le tier free)

---

## 1. Base de données Neon (gratuit)

1. Créer un projet sur [console.neon.tech](https://console.neon.tech)
2. Copier la **connection string** PostgreSQL (`DATABASE_URL`)
3. Format : `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`

**Migrations** (depuis votre Mac, une fois) :

```bash
cd /chemin/vers/ESTHER
export DATABASE_URL="postgresql://..."   # URL Neon
npx prisma migrate deploy
npm run db:seed:production
```

Créer le premier compte propriétaire (si inscription fermée) :

```bash
npm run org:create -- \
  --name "Ma Société" \
  --email "vous@email.com" \
  --password "MotDePasseSecurise123!"
```

Pour une **démo rapide** avec inscription sur le site, utiliser plutôt les variables Vercel `REGISTRATION_MODE=open_dev` et `ALLOW_PUBLIC_SIGNUP=true` (voir ci-dessous).

---

## 2. Pousser sur GitHub

```bash
cd /Users/samuelabettan/Desktop/ESTHER

# Initialiser Git (si pas encore fait)
git init
git branch -M main

# Vérifier qu'aucun secret n'est suivi
git status
# .env ne doit PAS apparaître

git add .
git commit -m "Préparation déploiement Vercel"

# Créer un repo vide sur github.com → New repository → sans README
git remote add origin https://github.com/VOTRE_USER/VOTRE_REPO.git
git push -u origin main
```

---

## 3. Connecter Vercel

1. [vercel.com/new](https://vercel.com/new)
2. **Import Git Repository** → choisir le repo GitHub
3. Framework : **Next.js** (détecté automatiquement)
4. **Build Command** : laisser vide ou `npm run vercel-build` (script dédié dans `package.json`)
5. **Install Command** : `npm ci` (défaut)
6. **Output Directory** : laisser vide (défaut Next.js)

### Variables d'environnement Vercel

Dans **Settings → Environment Variables**, ajouter (Production + Preview) :

| Variable | Exemple |
|----------|---------|
| `DATABASE_URL` | URL Neon |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `APP_ENV` | `production` |
| `NEXT_PUBLIC_APP_ENV` | `production` |
| `NEXT_PUBLIC_APP_NAME` | `Nova Gestion` |
| `NEXT_PUBLIC_APP_URL` | `https://votre-projet.vercel.app` (mettre à jour après 1er deploy) |
| `SEED_DEV_DATA` | `false` |
| `ENABLE_DEV_LOGIN` | `false` |
| `NEXT_PUBLIC_ENABLE_DEV_LOGIN` | `false` |
| `REGISTRATION_MODE` | `open_dev` (démo) ou `invite_only` |
| `ALLOW_PUBLIC_SIGNUP` | `true` (si démo open_dev) |
| `EMAIL_PROVIDER` | `resend` |
| `EMAIL_FROM` | `Nova Gestion <onboarding@resend.dev>` |
| `RESEND_API_KEY` | clé Resend |
| `STORAGE_PROVIDER` | `local` (démo) ou `s3` (R2) |
| `STORAGE_PATH` | `/tmp/uploads` |

Référence complète : `.env.vercel.example`

7. **Deploy**

---

## 4. Après le premier déploiement

1. Copier l’URL Vercel (`https://xxx.vercel.app`)
2. Mettre à jour `NEXT_PUBLIC_APP_URL` dans Vercel avec cette URL exacte
3. **Redeploy** (Deployments → … → Redeploy)

---

## 5. Checklist post-déploiement

- [ ] `https://votre-projet.vercel.app` s’ouvre
- [ ] `https://votre-projet.vercel.app/api/health` → `"status":"healthy"`
- [ ] `/register` crée une organisation (si open_dev) ou login avec compte `org:create`
- [ ] `/dashboard` accessible après connexion
- [ ] Créer un client, un devis
- [ ] Désactiver `ALLOW_PUBLIC_SIGNUP` après démo si besoin

---

## Build Vercel

Le script `vercel-build` exécute :

```bash
prisma generate && prisma migrate deploy && next build
```

`postinstall` lance déjà `prisma generate` à l’installation.

**Interdit en production** : `prisma db push`, `prisma migrate reset`.

---

## Limites gratuites

| Service | Limite |
|---------|--------|
| Vercel Hobby | Bande passante, fonctions serverless |
| Neon free | 0.5 Go stockage, scale-to-zero |
| Resend free | 100 emails / jour |
| Stockage `local` sur Vercel | **Non persistant** (PDF/uploads perdus au redéploiement) → utiliser R2 pour une vraie démo fichiers |

---

## Dépannage

| Problème | Solution |
|----------|----------|
| Build échoue Prisma | Vérifier `DATABASE_URL` présente au build |
| 500 au login | `SESSION_SECRET` ≥ 32 caractères |
| Email ne part pas | `RESEND_API_KEY` + `EMAIL_FROM` vérifiés |
| Redirect loop | `NEXT_PUBLIC_APP_URL` = URL Vercel exacte |
| Upload/PDF perdus | Passer à R2 (`STORAGE_PROVIDER=s3`) |
