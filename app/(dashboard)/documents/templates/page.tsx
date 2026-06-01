import { DocumentTemplatesClient } from "@/components/documents/document-templates-client";
import { requireAuth } from "@/lib/auth";
import { listDocumentTemplatesAction } from "@/server/actions/document-template.actions";

export default async function DocumentTemplatesPage() {
  const user = await requireAuth();
  const templates = await listDocumentTemplatesAction();
  return <DocumentTemplatesClient user={user} templates={templates} />;
}
