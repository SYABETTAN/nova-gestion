#!/usr/bin/env bash
# Reproduit la pipeline CI en local (PostgreSQL requis sur localhost:5432).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DATABASE_URL="${DATABASE_URL:-postgresql://esther:esther@localhost:5432/esther_test?schema=public}"
export SESSION_SECRET="${SESSION_SECRET:-ci-test-session-secret-min-32-chars!!}"
export APP_ENV=development
export NODE_ENV=test
export SEED_DEV_DATA=false
export ENABLE_DEV_LOGIN=false
export EMAIL_PROVIDER=mock
export STORAGE_PROVIDER=local
export STORAGE_PATH="${STORAGE_PATH:-/tmp/esther-uploads-local-ci}"
export NEXT_PUBLIC_APP_NAME="Joey & Joey"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"

echo "==> CI locale Joey & Joey"
echo "    DATABASE_URL=$DATABASE_URL"

echo "==> npm ci"
npm ci

echo "==> Prisma"
npx prisma validate
npx prisma generate
npx prisma migrate deploy
npm run db:seed:production
npx prisma migrate status | grep -q "following migration have not yet been applied" && {
  echo "ERREUR: migrations en attente"
  exit 1
} || true

echo "==> Lint"
npm run lint

echo "==> Typecheck"
npm run typecheck

echo "==> Tests"
npm test

echo "==> Build"
npm run build

echo ""
echo "✅ Pipeline qualité OK"
echo "   E2E smoke : npm run db:seed:ci-e2e && npm run build && npm run test:e2e:smoke"
