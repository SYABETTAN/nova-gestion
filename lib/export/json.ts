export type JsonExportMetadata = {
  organizationName: string;
  generatedAt: string;
  environment: string;
  exportType: string;
  filters?: Record<string, unknown>;
  rowCount: number;
};

export function sanitizeExportData<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeExportData(item)) as T;
  }
  if (data && typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (key === "passwordHash" || key === "iban" || key === "bic") continue;
      if (key === "bankAccountNumber" && typeof value === "string" && value.length > 4) {
        out[key] = `****${value.slice(-4)}`;
        continue;
      }
      out[key] = sanitizeExportData(value);
    }
    return out as T;
  }
  return data;
}

/** @deprecated Utiliser sanitizeExportData */
export const sanitizeJsonForSandbox = sanitizeExportData;

export function generateJsonExport<T>(metadata: JsonExportMetadata, data: T[]): string {
  const payload = {
    metadata,
    data: sanitizeExportData(data),
  };
  return JSON.stringify(payload, null, 2);
}
