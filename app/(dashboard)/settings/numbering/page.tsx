import { NumberingPageClient } from "@/components/numbering/numbering-page-client";
import { requireAuth } from "@/lib/auth";
import { getNumberingSequencesAction } from "@/server/actions/numbering.actions";

export default async function NumberingPage() {
  const user = await requireAuth();
  const sequences = await getNumberingSequencesAction();

  return <NumberingPageClient user={user} sequences={sequences} />;
}
