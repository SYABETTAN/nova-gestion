import type { PaymentTerm } from "@prisma/client";

export function validatePaymentTermDays(days: number): boolean {
  return days >= 0 && days <= 120;
}

export function filterActivePaymentTerms(terms: PaymentTerm[]): PaymentTerm[] {
  return terms.filter((t) => t.isActive);
}

export function pickDefaultPaymentTerm(terms: PaymentTerm[]): PaymentTerm | undefined {
  const active = filterActivePaymentTerms(terms);
  return active.find((t) => t.isDefault) ?? active[0];
}
