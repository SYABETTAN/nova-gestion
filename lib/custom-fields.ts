import { slugifyKey } from "@/lib/settings-utils";

export function generateCustomFieldKey(label: string): string {
  return slugifyKey(label);
}

export function validateCustomFieldSelectOptions(fieldType: string, options?: string | null): boolean {
  if (fieldType !== "SELECT") return true;
  return Boolean(options && options.trim().length > 0);
}

export function isDuplicateCustomFieldKey(
  existingKeys: string[],
  key: string,
  entityType: string,
  existing: { key: string; entityType: string }[],
): boolean {
  return existing.some((f) => f.entityType === entityType && f.key === key && !existingKeys.includes(key));
}
