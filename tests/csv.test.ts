import { describe, expect, it } from "vitest";
import { guessMapping, mapRows, normalizeMerchant, parseAmount, parseCsv } from "../src/csv";

describe("CSV import", () => {
  it("parses quoted commas, escaped quotes, BOM, and CRLF", () => {
    const table = parseCsv('\uFEFFDate,Description,Amount\r\n2026-08-01,"SHOP, INC.",-12.40\r\n2026-08-02,"Said ""hello""",8.00');
    expect(table.headers).toEqual(["Date", "Description", "Amount"]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]?.Description).toBe("SHOP, INC.");
    expect(table.rows[1]?.Description).toBe('Said "hello"');
  });

  it("rejects a malformed quoted field", () => {
    expect(() => parseCsv('Date,Description\n2026-08-01,"unfinished')).toThrow(/unclosed/i);
  });

  it("reads common amount formats", () => {
    expect(parseAmount("($1,204.20)")).toBe(-1204.2);
    expect(parseAmount("85.00-")).toBe(-85);
    expect(parseAmount("£42.10")).toBe(42.1);
    expect(parseAmount("not money")).toBeNull();
  });

  it("guesses common columns and maps separate debit/credit values", () => {
    const table = parseCsv("Posting Date,Payee,Debit,Credit\n28/08/2026,Market,12.50,\n29/08/2026,Employer,,1500");
    const mapping = { ...guessMapping(table.headers), dateFormat: "dmy" as const };
    const result = mapRows(table.rows, mapping);
    expect(result.errors).toEqual([]);
    expect(result.transactions.map((item) => item.amount)).toEqual([-12.5, 1500]);
    expect(result.transactions[0]?.date).toBe("2026-08-28");
  });

  it("uses one detected date order for an entire DMY statement", () => {
    const table = parseCsv("Date,Description,Amount,Category\n13/03/2026,RENT,-100,Home\n04/03/2026,GROCER,-20,Food");
    const result = mapRows(table.rows, guessMapping(table.headers));
    expect(result.errors).toEqual([]);
    expect(result.transactions.map((item) => item.date)).toEqual(["2026-03-04", "2026-03-13"]);
  });

  it("skips impossible ISO calendar dates with the normal recovery message", () => {
    const table = parseCsv("Date,Description,Amount\n2026-02-31,IMPOSSIBLE DATE,-9.99\n2026-02-28,VALID DATE,-1");
    const result = mapRows(table.rows, guessMapping(table.headers));
    expect(result.transactions.map((item) => item.date)).toEqual(["2026-02-28"]);
    expect(result.errors).toEqual(["Row 2 was skipped because its date, description, or amount could not be read."]);
  });

  it("asks for a date order instead of guessing an all-ambiguous statement", () => {
    const table = parseCsv("Date,Description,Amount\n04/03/2026,GROCER,-20");
    const result = mapRows(table.rows, guessMapping(table.headers));
    expect(result.transactions).toEqual([]);
    expect(result.errors[0]).toMatch(/choose a date order/i);
  });

  it("supports statements where a positive amount means spending", () => {
    const table = parseCsv("Date,Description,Amount\n2026-08-28,Market,12.50");
    const mapping = { ...guessMapping(table.headers), amountDirection: "expensesPositive" as const };
    expect(mapRows(table.rows, mapping).transactions[0]?.amount).toBe(-12.5);
  });

  it("normalizes volatile statement codes without cloud processing", () => {
    expect(normalizeMerchant("POS STREAMCO 483920 CARD")).toBe("STREAMCO");
  });
});
