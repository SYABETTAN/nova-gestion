/** Variables publiques disponibles côté client (NEXT_PUBLIC_*). */
import { APP_DISPLAY_NAME, APP_SHORT_LABEL } from "@/lib/branding";

export function appDisplayName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || APP_DISPLAY_NAME;
}

export function appShortLabel(): string {
  return APP_SHORT_LABEL;
}

export function isProductionClient(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "production";
}

export function simulatedActionsVisible(): boolean {
  return !isProductionClient();
}
