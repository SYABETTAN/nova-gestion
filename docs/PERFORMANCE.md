# Performance — audit et optimisations

## Mesure

```bash
# Qualité + build
npm run ci

# Analyse bundle (génère .next/analyze/*.html)
npm run build:analyze

# Logs Prisma lents (dev)
PRISMA_LOG_QUERIES=true npm run dev
```

## Optimisations appliquées

### Critique — Dashboard (`lib/dashboard-fetch.ts`, `lib/dashboard.ts`)

- **Avant** : 10 `findMany` sans limite (scan org entier + lignes facture + items).
- **Après** : requêtes ciblées avec filtres SQL (`issueDate`, `createdAt`, etc.), `count`/`aggregate`, lignes facture chargées uniquement pour la période.
- **Cache** : `unstable_cache` 60 s, clé `organizationId + période` (pas de fuite cross-tenant).

### Majeur — Stats listes (`lib/customers.ts`, `lib/invoices.ts`, `lib/quotes.ts`)

- **Avant** : `findMany` sur toutes les lignes pour calculer les stats en JS.
- **Après** : `count` + `aggregate` parallèles.

### Majeur — Recherche globale (`lib/search/search-service.ts`)

- Requêtes entités en **parallèle** (`Promise.all`).
- `include` remplacés par `select` minimal.
- Feature flags via cache org (`lib/org-cache.ts`).

### Majeur — Frontend

- **Recharts** : lazy load (`dashboard-charts-lazy.tsx`).
- **Command palette** : chargée uniquement à l’ouverture.
- **Skeletons** : `loading.tsx` dashboard, clients, factures, devis.

### Base de données

Migration `20250601190000_performance_indexes` — index composites `(organizationId, date)` sur factures, devis, paiements, etc.

### Production Vercel

- `compress: true`, `poweredByHeader: false` dans `next.config.ts`.

## Cache tenant-safe

| Donnée | TTL | Fichier |
|--------|-----|---------|
| Dashboard KPIs | 60 s | `lib/dashboard.ts` |
| Feature flags | 5 min | `lib/org-cache.ts` |
| Taux TVA | 10 min | `lib/org-cache.ts` |
| Devises | 10 min | `lib/org-cache.ts` |

Invalidation : tags `dashboard-{orgId}`, `org-{orgId}-modules`, etc. (revalidation automatique au TTL).

## Prochaines étapes recommandées

1. Full-text search PostgreSQL (`tsvector`) pour `contains` sur gros volumes.
2. Combobox async pour formulaires facture/devis (éviter chargement de tous les clients/articles).
3. Export CSV par batch/cursor.
4. `@vercel/speed-insights` en production pour métriques RUM.
