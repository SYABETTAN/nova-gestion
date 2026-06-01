# Monitoring

## Sonde de santé

```
GET /api/health
```

Réponse `200` si PostgreSQL répond ; `503` sinon.

```json
{
  "status": "healthy",
  "environment": "production",
  "checks": { "app": "ok", "database": "ok" }
}
```

Configurer un uptime monitor (Better Uptime, UptimeRobot, Vercel Monitoring) sur cette URL toutes les 1–5 minutes.

---

## Sentry (recommandé production)

### Installation

```bash
npm install @sentry/nextjs
```

### Configuration

1. Créer un projet Sentry (Next.js).
2. Définir sur l'hébergeur :
   - `SENTRY_DSN=https://...@....ingest.sentry.io/...`
3. `instrumentation.ts` initialise Sentry si le DSN est présent.

### Erreurs capturées automatiquement

- Exceptions non gérées des routes (via `onRequestError`)
- Appels explicites à `captureError()` (email, etc.)

### Tableau de bord

- Filtrer par `environment` = `staging` | `production`
- Alertes email/Slack sur taux d'erreur > seuil

---

## Vercel

- **Logs** : fonctions server, erreurs build
- **Analytics** (optionnel) : trafic, Web Vitals
- **Alerts** : échecs de déploiement

---

## Métriques métier (phase ultérieure)

Non implémentées dans cette étape ; prévoir :

- Taux d'échec email
- Latence génération PDF
- Volume uploads / jour

---

## Ce qui n'est pas monitoré par défaut

- Performance SQL fine (→ Neon dashboard)
- Coût R2 (→ Cloudflare billing)
