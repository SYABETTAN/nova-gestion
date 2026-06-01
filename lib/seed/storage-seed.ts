import { buildRelativeStoragePath, getStorageProvider } from "@/lib/storage";

/** PDF minimal valide pour les fixtures de développement. */
export const SEED_PLACEHOLDER_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n",
  "utf-8",
);

export async function seedPutFile(params: {
  organizationId: string;
  category: string;
  fileName: string;
  body: Buffer;
  mimeType: string;
}) {
  const storage = getStorageProvider();
  return storage.put({
    organizationId: params.organizationId,
    relativePath: buildRelativeStoragePath(params.category, params.fileName),
    body: params.body,
    mimeType: params.mimeType,
  });
}
