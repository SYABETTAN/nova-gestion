#!/usr/bin/env bash
# Démarre l'app Next.js en mode standalone (après npm run build).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .next/standalone/server.js ]]; then
  echo "ERREUR: exécutez npm run build d'abord"
  exit 1
fi

cp -r public .next/standalone/
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/

export HOSTNAME="${HOSTNAME:-0.0.0.0}"
export PORT="${PORT:-3000}"
exec node .next/standalone/server.js
