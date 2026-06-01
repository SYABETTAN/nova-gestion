"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PrintButton({ label = "Imprimer / exporter PDF" }: { label?: string }) {
  function handlePrint() {
    window.print();
    toast.info("Export PDF via impression navigateur.");
  }

  return (
    <div className="print:hidden fixed right-6 top-6 z-50">
      <Button onClick={handlePrint}>
        <Printer className="mr-2 h-4 w-4" />
        {label}
      </Button>
    </div>
  );
}
