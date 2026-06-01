import { ExportsCenterClient } from "@/components/exports/exports-center-client";
import { requireAuth } from "@/lib/auth";
import { listAvailableExportsAction } from "@/server/actions/export.actions";

export default async function ExportsPage() {
  const user = await requireAuth();
  const { exports } = await listAvailableExportsAction();
  return <ExportsCenterClient user={user} exports={exports} />;
}
