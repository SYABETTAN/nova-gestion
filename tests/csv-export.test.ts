import { describe, expect, it } from "vitest";
import { escapeCsvValue, generateCsv } from "@/lib/export/csv";

describe("csv export utilities", () => {
  it("escapeCsvValue échappe les guillemets", () => {
    expect(escapeCsvValue('Label "test"')).toBe('"Label ""test"""');
  });

  it("escapeCsvValue gère les points-virgules", () => {
    expect(escapeCsvValue("a;b")).toBe('"a;b"');
  });

  it("escapeCsvValue gère les retours ligne", () => {
    expect(escapeCsvValue("ligne1\nligne2")).toBe('"ligne1\nligne2"');
  });

  it("generateCsv crée les headers", () => {
    const csv = generateCsv(["col1", "col2"], []);
    expect(csv.split("\n")[0]).toBe("col1;col2");
  });

  it("generateCsv crée les lignes attendues", () => {
    const csv = generateCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe("1;2");
    expect(lines[2]).toBe("3;4");
  });
});
