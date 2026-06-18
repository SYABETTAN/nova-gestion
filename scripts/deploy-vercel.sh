#!/usr/bin/env bash
# Déploiement Vercel — à lancer après gh auth, vercel login, et variables exportées.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?DATABASE_URL requis}"
: "${SESSION_SECRET:?SESSION_SECRET requis (min 32 caractères)}"
: "${RESEND_API_KEY:?RESEND_API_KEY requis}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL requis pour org:create}"
: "${ADMIN_PASSWORD:?ADMIN_PASSWORD requis}"
: "${GITHUB_REPO:?GITHUB_REPO requis ex. user/nova-gestion}"

APP_URL="${NEXT_PUBLIC_APP_URL:-}"
if [[ -z "$APP_URL" ]]; then
  echo "NEXT_PUBLIC_APP_URL optionnel au 1er deploy — à mettre à jour après."
fi

echo "→ Migrations Neon…"
npx prisma migrate deploy
npm run db:seed:production

echo "→ Organisation admin…"
npm run org:create -- --name "${ORG_NAME:-Joey & Joey}" --email "$ADMIN_EMAIL" --password "$ADMIN_PASSWORD"

if ! git remote get-url origin &>/dev/null; then
  echo "→ Repo GitHub…"
  gh repo create "${GITHUB_REPO##*/}" --private --source=. --remote=origin --push
else
  git push -u origin main
fi

echo "→ Variables Vercel…"
vercel link --yes 2>/dev/null || vercel link

vercel env add DATABASE_URL production <<< "$DATABASE_URL" 2>/dev/null || true
vercel env add SESSION_SECRET production <<< "$SESSION_SECRET" 2>/dev/null || true
vercel env add RESEND_API_KEY production <<< "$RESEND_API_KEY" 2>/dev/null || true

echo "→ Deploy production…"
vercel deploy --prod --yes

echo "✓ Terminé. Ouvrez l’URL affichée ci-dessus."
