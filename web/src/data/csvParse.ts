import Papa from "papaparse";

/** Normalizes every cell to a trimmed string so numeric CSV fields never break string helpers. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
  const data = parsed.data as Record<string, unknown>[];
  return data.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!k) continue;
      out[k] = v == null || v === "" ? "" : String(v).trim();
    }
    return out;
  });
}
