import { notFound } from "next/navigation";
import { DocumentDetailClient } from "@/components/documents/document-detail-client";
import { requireAuth } from "@/lib/auth";
import { getDocumentByIdAction } from "@/server/actions/document.actions";

type PageProps = { params: Promise<{ id: string }> };

export default async function DocumentDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;
  try {
    const document = await getDocumentByIdAction(id);
    return <DocumentDetailClient user={user} document={document} />;
  } catch {
    notFound();
  }
}
