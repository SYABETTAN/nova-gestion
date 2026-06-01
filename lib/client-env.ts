/** Variables publiques disponibles côté client (NEXT_PUBLIC_*). */
export function isProductionClient(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "production";
}

export function simulatedActionsVisible(): boolean {
  return !isProductionClient();
}
