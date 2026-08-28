import { describe, expect, it } from "vitest";
import { applyRules, compareMonths, findRecurring, monthSummary } from "../src/analysis";
import type { Transaction } from "../src/types";

const tx = (date: string, merchant: string, amount: number, category = "Subscriptions"): Transaction => ({
  id: `${date}-${merchant}-${amount}`,
  date,
  description: merchant,
  merchant,
  amount,
  category,
  splits: []
});

describe("review analysis", () => {
  it("identifies a stable monthly recurring charge with evidence", () => {
    const result = findRecurring([
      tx("2026-06-05", "StreamCo", -14.99),
      tx("2026-07-05", "StreamCo", -14.99),
      tx("2026-08-05", "StreamCo", -15.49)
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.confidence).toBe("likely");
    expect(result[0]?.cadence).toBe("about monthly");
  });

  it("does not call two irregular transactions recurring", () => {
    expect(findRecurring([tx("2026-06-01", "Shop", -20), tx("2026-06-10", "Shop", -22)])).toEqual([]);
  });

  it("applies an explicit merchant merge rule without hiding the description", () => {
    const original = tx("2026-08-01", "STREAMCO 4821", -10);
    original.description = "CARD STREAMCO 4821";
    const merged = applyRules(original, [{ id: "1", match: "streamco", merchant: "StreamCo", category: "Media" }]);
    expect(merged.merchant).toBe("StreamCo");
    expect(merged.category).toBe("Media");
    expect(merged.description).toBe("CARD STREAMCO 4821");
  });

  it("compares category spend and respects split transactions", () => {
    const mixed = tx("2026-08-08", "Superstore", -100, "Shopping");
    mixed.splits = [{ id: "a", label: "Groceries", amount: 70 }, { id: "b", label: "Home", amount: 30 }];
    const result = compareMonths([
      tx("2026-07-08", "Market", -50, "Groceries"),
      mixed
    ], "2026-08", "2026-07");
    expect(result.find((item) => item.category === "Groceries")?.delta).toBe(20);
    expect(result.find((item) => item.category === "Home")?.previous).toBe(0);
  });

  it("summarizes income, spending, and net", () => {
    expect(monthSummary([tx("2026-08-01", "Employer", 2500, "Income"), tx("2026-08-02", "Rent", -900, "Home")], "2026-08"))
      .toEqual({ income: 2500, spending: 900, net: 1600 });
  });
});
