import type { CategoryChange, MerchantRule, RecurringCandidate, Review, Transaction } from "./types";

export function applyRules(transaction: Transaction, rules: MerchantRule[]): Transaction {
  const description = transaction.description.toLowerCase();
  const rule = rules.find((item) => description.includes(item.match.toLowerCase()));
  if (!rule) return transaction;
  return { ...transaction, merchant: rule.merchant, category: rule.category || transaction.category };
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function findRecurring(transactions: Transaction[]): RecurringCandidate[] {
  const groups = new Map<string, Transaction[]>();
  transactions.filter((transaction) => transaction.amount < 0).forEach((transaction) => {
    const key = transaction.merchant.trim().toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  });
  return [...groups.values()].flatMap((items) => {
    if (items.length < 2) return [];
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = sorted.map((item) => Math.abs(item.amount));
    const average = amounts.reduce((total, amount) => total + amount, 0) / amounts.length;
    const amountSpread = Math.max(...amounts.map((amount) => Math.abs(amount - average) / Math.max(average, 0.01)));
    const intervals = sorted.slice(1).map((item, index) => daysBetween(sorted[index]!.date, item.date));
    const monthly = intervals.some((days) => days >= 25 && days <= 35);
    const regular = intervals.every((days) => (days >= 25 && days <= 35) || (days >= 6 && days <= 8) || (days >= 12 && days <= 16));
    if (!monthly && !(items.length >= 3 && regular)) return [];
    return [{
      merchant: sorted[0]!.merchant,
      transactions: sorted,
      typicalAmount: average,
      confidence: amountSpread <= 0.08 && regular ? "likely" as const : "possible" as const,
      cadence: monthly ? "about monthly" : intervals[0]! <= 8 ? "about weekly" : "about fortnightly"
    }];
  }).sort((a, b) => b.typicalAmount - a.typicalAmount);
}

export function flattenTransactions(reviews: Review[], rules: MerchantRule[] = []): Transaction[] {
  return reviews.flatMap((review) => review.transactions).map((transaction) => applyRules(transaction, rules));
}

export function availableMonths(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map((transaction) => transaction.date.slice(0, 7)))].sort();
}

function categorySpend(transactions: Transaction[], month: string): Map<string, number> {
  const totals = new Map<string, number>();
  transactions.filter((transaction) => transaction.date.startsWith(month) && transaction.amount < 0).forEach((transaction) => {
    if (transaction.splits.length) {
      transaction.splits.forEach((split) => totals.set(split.label, (totals.get(split.label) ?? 0) + Math.abs(split.amount)));
    } else {
      totals.set(transaction.category, (totals.get(transaction.category) ?? 0) + Math.abs(transaction.amount));
    }
  });
  return totals;
}

export function compareMonths(transactions: Transaction[], current: string, previous: string): CategoryChange[] {
  const currentTotals = categorySpend(transactions, current);
  const previousTotals = categorySpend(transactions, previous);
  const categories = new Set([...currentTotals.keys(), ...previousTotals.keys()]);
  return [...categories].map((category) => {
    const currentValue = currentTotals.get(category) ?? 0;
    const previousValue = previousTotals.get(category) ?? 0;
    const delta = currentValue - previousValue;
    return {
      category,
      current: currentValue,
      previous: previousValue,
      delta,
      percent: previousValue ? (delta / previousValue) * 100 : null
    };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

export function monthSummary(transactions: Transaction[], month: string): { income: number; spending: number; net: number } {
  const monthTransactions = transactions.filter((transaction) => transaction.date.startsWith(month));
  const income = monthTransactions.filter((transaction) => transaction.amount > 0).reduce((total, transaction) => total + transaction.amount, 0);
  const spending = monthTransactions.filter((transaction) => transaction.amount < 0).reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
  return { income, spending, net: income - spending };
}
