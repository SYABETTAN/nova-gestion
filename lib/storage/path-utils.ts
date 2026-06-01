import { createHash, randomBytes } from "crypto";
import path from "path";

const UNSAFE_CHARS = /[^a-zA-Z0-9._-]/g;

/** Nom de fichier affiché sécurisé (sans chemin). */
export function sanitizeFileName(fileName: string): string {
  const base = path.basename(fileName).replace(UNSAFE_CHARS, "_").slice(0, 200);
  return base || "fichier";
}

/** Extension autorisée (minuscule, sans point initial). */
export function extractSafeExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().replace(/^\./, "");
  if (!ext || ext.length > 10) return "bin";
  if (!/^[a-z0-9]+$/.test(ext)) return "bin";
  return ext;
}

export function buildRelativeStoragePath(category: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  const ext = extractSafeExtension(safeName);
  const base = safeName.replace(new RegExp(`\\.${ext}$`, "i"), "").slice(0, 80) || "fichier";
  const unique = randomBytes(16).toString("hex");
  return `${category}/${unique}-${base}.${ext}`;
}

/** Chemin complet incluant l'organisation (clé de stockage finale). */
export function buildStorageKey(params: {
  organizationId: string;
  category: string;
  fileName: string;
}): string {
  return `${params.organizationId}/${buildRelativeStoragePath(params.category, params.fileName)}`;
}

export function sha256Checksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
