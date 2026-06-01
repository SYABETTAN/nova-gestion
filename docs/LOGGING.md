# Stratégie de logs

## Format

Logs serveur **JSON structuré** via `lib/observability/logger.ts` :

```json
{"ts":"2026-05-29T12:00:00.000Z","level":"info","message":"...","env":"production","area":"auth"}
```

Niveau minimal : `LOG_LEVEL` (`debug` en dev, `info` en staging/prod).

## Événements journalisés

| Domaine | Niveau | Exemple |
|---------|--------|---------|
| Auth | info / warn | login réussi, session invalide (sans mot de passe) |
| Invitations | info | invitation créée, acceptée |
| Email | info / error | envoi OK, échec Resend |
| Uploads | info | document téléversé (id, org, taille — pas le contenu) |
| Erreurs serveur | error | via `captureError()` |
| Paiements | info | création paiement (montant agrégé OK, pas IBAN complet) |

## Interdictions

- Ne jamais logger : mots de passe, `SESSION_SECRET`, tokens invitation en clair, `RESEND_API_KEY`, corps email complet, numéros de carte.
- Le logger **masque** automatiquement les clés contenant `password`, `secret`, `token`, `api_key`.

## Consultation

| Environnement | Où |
|---------------|-----|
| Local | Terminal `npm run dev` |
| Vercel | Project → Logs (filtrer `level:error`) |
| Sentry | Stack traces + contexte `area` |

## Extension

Pour un événement métier :

```typescript
import { logger } from "@/lib/observability/logger";

logger.info("Invitation envoyée", {
  area: "invitations",
  organizationId: org.id,
  invitationId: inv.id,
});
```

Pour une erreur :

```typescript
import { captureError } from "@/lib/observability/capture-error";

captureError(err, { area: "email", organizationId: user.organizationId });
```
