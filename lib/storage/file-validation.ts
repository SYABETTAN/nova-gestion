const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 Mo

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "scr",
  "js",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "jsx",
  "html",
  "htm",
  "php",
  "sh",
  "bash",
  "ps1",
  "vbs",
  "jar",
  "app",
  "dmg",
  "svg", // XSS vector when served inline
]);

const ALLOWED_MIME_BY_EXT: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  csv: ["text/csv", "application/csv", "text/plain"],
  txt: ["text/plain"],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
  ],
  xls: ["application/vnd.ms-excel", "application/octet-stream"],
  doc: ["application/msword", "application/octet-stream"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream",
  ],
  zip: ["application/zip", "application/x-zip-compressed"],
};

export type FileValidationResult =
  | { valid: true; extension: string; mimeType: string }
  | { valid: false; error: string };

export function validateUploadFile(fileName: string, mimeType: string, sizeBytes: number): FileValidationResult {
  if (sizeBytes <= 0) {
    return { valid: false, error: "Le fichier est vide." };
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Fichier trop volumineux (max. ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)} Mo).`,
    };
  }

  const ext = fileName.includes(".")
    ? fileName.split(".").pop()!.toLowerCase()
  : "";

  if (!ext || BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: "Type de fichier non autorisé." };
  }

  const allowedMimes = ALLOWED_MIME_BY_EXT[ext];
  if (!allowedMimes) {
    return { valid: false, error: `Extension .${ext} non autorisée.` };
  }

  const normalizedMime = mimeType.toLowerCase().split(";")[0]!.trim();
  if (!allowedMimes.includes(normalizedMime) && normalizedMime !== "application/octet-stream") {
    return { valid: false, error: "Type MIME incompatible avec l'extension du fichier." };
  }

  return { valid: true, extension: ext, mimeType: normalizedMime || allowedMimes[0]! };
}

export function getMaxUploadSizeBytes(): number {
  return MAX_FILE_SIZE_BYTES;
}
