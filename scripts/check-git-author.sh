#!/usr/bin/env bash
# Vérifie que l'email Git est compatible Vercel avant un push.
set -euo pipefail
EMAIL=$(git config user.email || echo "")
GOOD="203708253+SYABETTAN@users.noreply.github.com"
if [[ "$EMAIL" != "$GOOD" ]]; then
  echo "⚠️  Email Git actuel : ${EMAIL:-non défini}"
  echo "    Vercel rejette samuelabettan@Mac.lan — configurez :"
  echo "    git config --local user.email \"$GOOD\""
  exit 1
fi
echo "✓ Email Git OK pour Vercel ($EMAIL)"
