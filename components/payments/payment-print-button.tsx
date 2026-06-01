"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <div className="print:hidden border-b bg-white p-4 text-center">
      <Button onClick={() => window.print()}>Imprimer / PDF</Button>
    </div>
  );
}
