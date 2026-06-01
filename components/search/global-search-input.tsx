"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGlobalSearchShortcut } from "@/hooks/use-global-search-shortcut";
import type { SessionUser } from "@/lib/permissions";

const GlobalCommandPalette = dynamic(
  () =>
    import("@/components/search/global-command-palette").then((m) => m.GlobalCommandPalette),
  { ssr: false, loading: () => null },
);

function shortcutLabel() {
  if (typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)) {
    return "⌘K";
  }
  return "Ctrl K";
}

export function GlobalSearchInput({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [seedQuery, setSeedQuery] = useState("");

  useGlobalSearchShortcut(() => setOpen(true));

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="hidden w-full max-w-md justify-start gap-2 text-slate-500 md:flex"
        onClick={() => {
          setSeedQuery("");
          setOpen(true);
        }}
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Rechercher un client, une facture, un devis…</span>
        <kbd className="pointer-events-none hidden rounded border bg-slate-100 px-1.5 py-0.5 text-xs font-medium sm:inline">
          {shortcutLabel()}
        </kbd>
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="md:hidden"
        aria-label="Rechercher"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4" />
      </Button>
      {open ? (
        <GlobalCommandPalette
          open={open}
          onOpenChange={setOpen}
          user={user}
          initialQuery={seedQuery}
        />
      ) : null}
    </>
  );
}
