import type { ColumnMapping, Transaction } from "./types";

export type CsvTable = { headers: string[]; rows: Record<string, string>[] };

export function parseCsv(input: string): CsvTable {
  const text = input.replace(/^\uFEFF/, "");
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      if (row.some(Boolean)) matrix.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) matrix.push(row);
  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  const rawHeaders = matrix.shift() ?? [];
  if (rawHeaders.length < 2) throw new Error("The CSV needs a header row with at least two columns.");
  const seen = new Map<string, number>();
  const headers = rawHeaders.map((header, index) => {
    const base = header || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base} (${count + 1})` : base;
  });
  const rows = matrix.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  return { headers, rows };
}

const candidates = {
  date: ["date", "posted", "transaction date", "posting date"],
  description: ["description", "merchant", "details", "payee", "memo", "narrative"],
  amount: ["amount", "value", "transaction amount"],
  debit: ["debit", "withdrawal", "money out", "outflow"],
  credit: ["credit", "deposit", "money in", "inflow"],
  category: ["category", "type"]
};

export function guessMapping(headers: string[], previous?: ColumnMapping): ColumnMapping {
  const find = (key: keyof typeof candidates) => {
    const remembered = previous?.[key];
    if (typeof remembered === "string" && headers.includes(remembered)) return remembered;
    const lowered = headers.map((header) => header.toLowerCase());
    const exact = candidates[key].find((candidate) => lowered.includes(candidate));
    if (exact) return headers[lowered.indexOf(exact)] ?? "";
    const partialIndex = lowered.findIndex((header) => candidates[key].some((candidate) => header.includes(candidate)));
    return partialIndex >= 0 ? headers[partialIndex] ?? "" : "";
  };
  return {
    date: find("date"),
    description: find("description"),
    amount: find("amount"),
    debit: find("debit"),
    credit: find("credit"),
    category: find("category"),
    dateFormat: previous?.dateFormat ?? "auto",
    amountDirection: previous?.amountDirection ?? "expensesNegative"
  };
}

export function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const negative = /^\(.*\)$/.test(trimmed) || trimmed.endsWith("-");
  const cleaned = trimmed.replace(/[\s,$£€¥₹()]/g, "").replace(/-$/, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function isoDate(value: string, format: ColumnMapping["dateFormat"]): string | null {
  const clean = value.trim();
  const direct = /^\d{4}-\d{1,2}-\d{1,2}/.exec(clean);
  if (direct) {
    const [year, month, day] = direct[0].split("-").map(Number);
    if (year && month && day) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const match = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(clean);
  if (match) {
    let first = Number(match[1]);
    let second = Number(match[2]);
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    const useDmy = format === "dmy" || (format === "auto" && first > 12);
    const month = useDmy ? second : first;
    const day = useDmy ? first : second;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const timestamp = Date.parse(clean);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString().slice(0, 10);
}

export function normalizeMerchant(description: string): string {
  const merchant = description
    .toUpperCase()
    .replace(/\b\d{4,}\b/g, "")
    .replace(/\b(?:POS|ACH|DEBIT|CREDIT|CARD|PAYMENT|PURCHASE|ONLINE|RECURRING)\b/g, "")
    .replace(/[#*]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-\s]+|[-\s]+$/g, "")
    .trim();
  return merchant || description.trim() || "Unlabelled transaction";
}

export function mapRows(rows: Record<string, string>[], mapping: ColumnMapping): { transactions: Transaction[]; errors: string[] } {
  if (!mapping.date || !mapping.description || (!mapping.amount && !mapping.debit && !mapping.credit)) {
    throw new Error("Choose date, description, and either amount or debit/credit columns.");
  }
  const errors: string[] = [];
  const transactions: Transaction[] = [];
  rows.forEach((row, index) => {
    const date = isoDate(row[mapping.date] ?? "", mapping.dateFormat);
    let amount: number | null = null;
    if (mapping.amount) {
      amount = parseAmount(row[mapping.amount] ?? "");
      if (amount !== null && mapping.amountDirection === "expensesPositive") amount *= -1;
    }
    else {
      const debit = parseAmount(row[mapping.debit] ?? "") ?? 0;
      const credit = parseAmount(row[mapping.credit] ?? "") ?? 0;
      amount = credit - Math.abs(debit);
    }
    const description = (row[mapping.description] ?? "").trim();
    if (!date || amount === null || !description) {
      errors.push(`Row ${index + 2} was skipped because its date, description, or amount could not be read.`);
      return;
    }
    transactions.push({
      id: crypto.randomUUID(),
      date,
      description,
      merchant: normalizeMerchant(description),
      amount,
      category: (mapping.category ? row[mapping.category] : "")?.trim() || (amount >= 0 ? "Income" : "Uncategorized"),
      splits: []
    });
  });
  transactions.sort((a, b) => a.date.localeCompare(b.date));
  return { transactions, errors };
}

export function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
