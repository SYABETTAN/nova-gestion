import { DocumentsPageClient } from "@/components/documents/documents-page-client";
import { listDocumentsAction } from "@/server/actions/document.actions";

type PageProps = { searchParams: Promise<Record<string, string | undefined>> };

export default async function DocumentsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { documents } = await listDocumentsAction(params);
  return <DocumentsPageClient documents={documents} />;
}
