export type ColumnMapping = {
  date: string;
  description: string;
  amount: string;
  debit: string;
  credit: string;
  category: string;
  dateFormat: "auto" | "mdy" | "dmy" | "ymd";
  amountDirection: "expensesNegative" | "expensesPositive";
};

export type Split = { id: string; label: string; amount: number };

export type Transaction = {
  id: string;
  date: string;
  description: string;
  merchant: string;
  amount: number;
  category: string;
  splits: Split[];
};

export type MerchantRule = {
  id: string;
  match: string;
  merchant: string;
  category: string;
};

export type ChecklistItem = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
  kind: "recurring" | "change" | "custom";
};

export type Review = {
  id: string;
  filename: string;
  importedAt: string;
  transactions: Transaction[];
  checklist: ChecklistItem[];
  notes: string;
  sourceCsv?: string;
};

export type AppData = {
  version: 1;
  reviews: Review[];
  rules: MerchantRule[];
  mapping?: ColumnMapping;
};

export type RecurringCandidate = {
  merchant: string;
  transactions: Transaction[];
  typicalAmount: number;
  confidence: "likely" | "possible";
  cadence: string;
};

export type CategoryChange = {
  category: string;
  current: number;
  previous: number;
  delta: number;
  percent: number | null;
};
