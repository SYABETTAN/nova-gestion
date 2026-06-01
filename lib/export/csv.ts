export function escapeCsvValue(value: unknown, separator = ";"): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(separator) || str.includes('"') || str.includes("\n") || str.includes(",")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCsv(
  headers: string[],
  rows: unknown[][],
  separator = ";",
): string {
  const lines = [headers.map((h) => escapeCsvValue(h, separator)).join(separator)];
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvValue(cell, separator)).join(separator));
  }
  return lines.join("\n");
}
