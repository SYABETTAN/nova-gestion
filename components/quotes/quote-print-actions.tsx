"use client";

import { Button } from "@/components/ui/button";

export function QuotePrintActions() {
  return (
    <Button onClick={() => window.print()} className="no-print">
      Imprimer / Exporter PDF
    </Button>
  );
}
