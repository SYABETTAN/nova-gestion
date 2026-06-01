"use client";

import { Button } from "@/components/ui/button";

export function InvoicePrintActions() {
  return (
    <Button onClick={() => window.print()} className="print:hidden">
      Imprimer / Exporter PDF
    </Button>
  );
}
