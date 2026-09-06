import { expect, test, type Download, type Page } from "@playwright/test";

const sampleHeading = "Your statement review";

async function openDemo(page: Page): Promise<void> {
  await page.goto("/demo/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: sampleHeading })).toBeVisible();
}

async function openTab(page: Page, name: RegExp): Promise<void> {
  await page.getByRole("button", { name }).click();
}

async function downloadText(download: Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function readDatabase(page: Page, name: string): Promise<unknown> {
  return page.evaluate((databaseName) => new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const value = database.transaction("local-data").objectStore("local-data").get("app");
      value.onsuccess = () => { database.close(); resolve(value.result ?? null); };
      value.onerror = () => { database.close(); reject(value.error); };
    };
  }), name);
}

test("@claim:csv-import-formats imports signed amounts and separate debit and credit columns", async ({ page }) => {
  await openDemo(page);
  await expect(page.locator(".summary-strip")).toContainText("3,200.00");
  await expect(page.locator(".summary-strip")).toContainText("522.79");
  await page.getByRole("button", { name: /Import another month/ }).click();
  await page.locator("#csv-file").setInputFiles({
    name: "debit-credit.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Posting Date,Payee,Debit,Credit,Category\n2026-08-02,LOCAL MARKET,42.50,,Groceries\n2026-08-03,EMPLOYER,,1800.00,Income")
  });
  await page.getByRole("button", { name: /Import 2 rows/ }).click();
  await expect(page.locator(".summary-strip")).toContainText("1,800.00");
  await expect(page.locator(".summary-strip")).toContainText("42.50");
});

test("@claim:mapping-memory remembers column, date, and amount choices", async ({ page }) => {
  await openDemo(page);
  const file = { name: "custom.csv", mimeType: "text/csv", buffer: Buffer.from("When,Label,Value\n08/02/2026,SHOP,12.00") };
  await page.getByRole("button", { name: /Import another month/ }).click();
  await page.locator("#csv-file").setInputFiles(file);
  await page.locator('select[name="date"]').selectOption("When");
  await page.locator('select[name="description"]').selectOption("Label");
  await page.locator('select[name="amount"]').selectOption("Value");
  await page.locator('select[name="dateFormat"]').selectOption("mdy");
  await page.locator('select[name="amountDirection"]').selectOption("expensesPositive");
  await page.getByRole("button", { name: /Import 1 rows/ }).click();
  await page.getByRole("button", { name: /Import another month/ }).click();
  await page.locator("#csv-file").setInputFiles({ ...file, name: "custom-next.csv" });
  await expect(page.locator('select[name="date"]')).toHaveValue("When");
  await expect(page.locator('select[name="description"]')).toHaveValue("Label");
  await expect(page.locator('select[name="amount"]')).toHaveValue("Value");
  await expect(page.locator('select[name="dateFormat"]')).toHaveValue("mdy");
  await expect(page.locator('select[name="amountDirection"]')).toHaveValue("expensesPositive");
});

test("@claim:local-persistence restores reviews, rules, notes, and checklist state after reload", async ({ page }) => {
  await openDemo(page);
  await openTab(page, /Tidy/);
  await page.locator('#rule-form input[name="match"]').fill("STREAMCO");
  await page.locator('#rule-form input[name="merchant"]').fill("Stream Spot");
  await page.locator('#rule-form input[name="category"]').fill("Media");
  await page.getByRole("button", { name: "Save rule" }).click();
  await openTab(page, /Finish/);
  await page.locator("#review-notes").fill("Keep this note after reload.");
  await page.locator('[data-check-item]').first().check();
  await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" });
  await openTab(page, /Tidy/);
  await expect(page.locator(".saved-rules")).toContainText("Stream Spot");
  await openTab(page, /Finish/);
  await expect(page.locator("#review-notes")).toHaveValue("Keep this note after reload.");
  await expect(page.locator('[data-check-item]').first()).toBeChecked();
});

test("@claim:merchant-rules applies an explicit cleanup rule and keeps the source description", async ({ page }) => {
  await openDemo(page);
  await openTab(page, /Tidy/);
  await page.locator('#rule-form input[name="match"]').fill("STREAMCO");
  await page.locator('#rule-form input[name="merchant"]').fill("Stream Spot");
  await page.locator('#rule-form input[name="category"]').fill("Media");
  await page.getByRole("button", { name: "Save rule" }).click();
  const row = page.locator(".transaction-row").filter({ hasText: "STREAMCO*4821" });
  await expect(row).toContainText("Stream Spot");
  await expect(row).toContainText("Media");
  await expect(row).toContainText("STREAMCO*4821");
});

test("@claim:split-purchases splits one purchase into two exact category amounts", async ({ page }) => {
  await openDemo(page);
  await openTab(page, /Tidy/);
  const row = page.locator(".transaction-row").filter({ hasText: "CAFE AND BOOKS" });
  await row.locator("summary").click();
  await row.locator('input[name="label1"]').fill("Books");
  await row.locator('input[name="amount1"]').fill("30");
  await row.locator('input[name="label2"]').fill("Coffee");
  await row.locator('input[name="amount2"]').fill("16.50");
  await row.getByRole("button", { name: "Save changes" }).click();
  await openTab(page, /Compare/);
  await expect(page.locator(".change-list")).toContainText("Books");
  await expect(page.locator(".change-list")).toContainText("Coffee");
});

test("@claim:repeat-cadences finds monthly, weekly, and fortnightly candidates", async ({ page }) => {
  await openDemo(page);
  await openTab(page, /Repeat charges/);
  await expect(page.locator(".candidate").filter({ hasText: "STREAMCO" })).toContainText("about monthly");
  await expect(page.locator(".candidate").filter({ hasText: "CITY TRANSIT" })).toContainText("about weekly");
  await expect(page.locator(".candidate").filter({ hasText: "CARE CLINIC" })).toContainText("about fortnightly");
});

test("@claim:month-comparison compares the newest two months by category", async ({ page }) => {
  await openDemo(page);
  await openTab(page, /Compare/);
  await expect(page.getByRole("heading", { name: "July 2026 vs June 2026" })).toBeVisible();
  await expect(page.locator(".compare-summary")).toContainText("410.59 out");
  await expect(page.locator(".compare-summary")).toContainText("522.79 out");
  await expect(page.locator(".change-list")).toContainText("Groceries");
});

test("@claim:checklist-export downloads a Markdown checklist with every shown item", async ({ page }) => {
  await openDemo(page);
  await openTab(page, /Finish/);
  const shownItems = await page.locator(".checklist li").count();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export checklist" }).click();
  const text = await downloadText(await event);
  expect(text).toContain("# Private statement review — July 2026");
  expect((text.match(/^- \[[ x]\]/gm) ?? []).length).toBe(shownItems);
});

test("@claim:transaction-export downloads normalized CSV with one row per transaction", async ({ page }) => {
  await openDemo(page);
  await openTab(page, /Finish/);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export transactions" }).click();
  const text = await downloadText(await event);
  expect(text.split("\n")[0]).toBe("Date,Description,Merchant,Category,Amount");
  expect(text.trim().split("\n")).toHaveLength(22);
  expect(text).toContain("2026-07-05,STREAMCO*4821,STREAMCO,Subscriptions,-14.99");
});

test("@claim:data-backup-controls exports, validates, restores, and clears review data", async ({ page }) => {
  await openDemo(page);
  await openTab(page, /Finish/);
  await page.locator("#custom-check").fill("Backup marker");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export private backup" }).click();
  const backup = await downloadText(await event);
  await page.locator("#backup-file").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"version":1}') });
  await expect(page.locator("#live-notice")).toContainText("not a valid");
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByText("Backup marker")).toHaveCount(0);
  await openTab(page, /Finish/);
  await page.locator("#backup-file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(backup) });
  await expect(page.getByText("Backup marker")).toBeVisible();
  await page.getByRole("button", { name: "Clear all local data" }).click();
  await page.getByRole("button", { name: "Clear everything" }).click();
  await expect(page.getByText("Backup marker")).toHaveCount(0);
  await openTab(page, /Overview/);
  await expect(page.getByText("sample-household-june-july.csv")).toBeVisible();
});

test("@claim:offline-reload restores the sample after the network is disabled", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await openDemo(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload({ waitUntil: "networkidle" });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: sampleHeading })).toBeVisible();
  await expect(page.locator("#network-status")).toBeVisible();
  await openTab(page, /Finish/);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export transactions" }).click();
  expect(await downloadText(await event)).toContain("CITY TRANSIT");
  await context.close();
});

test("@claim:sample-demo opens populated output and never reads or changes the real database", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("private-statement-review", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("local-data");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("local-data", "readwrite");
      transaction.objectStore("local-data").put({ version: 1, reviews: [{ id: "real", filename: "real-sentinel.csv", importedAt: new Date().toISOString(), transactions: [{ id: "t", date: "2026-01-01", description: "REAL SENTINEL", merchant: "REAL SENTINEL", amount: -1, category: "Other", splits: [] }], checklist: [], notes: "real note" }], rules: [] }, "app");
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    };
  }));
  await page.getByRole("button", { name: "Try it with sample data" }).click();
  await expect(page.getByRole("heading", { name: sampleHeading })).toBeVisible();
  await expect(page.getByText("Demo — sample data, nothing is saved")).toBeVisible();
  await expect(page.getByText("real-sentinel.csv")).toHaveCount(0);
  await openTab(page, /Finish/);
  await page.locator("#review-notes").fill("Changed only in demo");
  await page.waitForTimeout(300);
  const real = JSON.stringify(await readDatabase(page, "private-statement-review"));
  const demo = JSON.stringify(await readDatabase(page, "private-statement-review-demo"));
  expect(real).toContain("real-sentinel.csv");
  expect(real).not.toContain("Changed only in demo");
  expect(demo).toContain("Changed only in demo");
  await page.getByRole("button", { name: "Start for real" }).click();
  await expect(page.getByText("real-sentinel.csv")).toBeVisible();
  expect(await readDatabase(page, "private-statement-review")).not.toBeNull();
});

test("@claim:no-bank-connection completes a sample review without credentials or a bank request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await openDemo(page);
  await openTab(page, /Repeat charges/);
  await expect(page.locator(".candidate")).toHaveCount(5);
  expect(await page.locator('input[type="password"]').count()).toBe(0);
  expect(requests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
});

test("@claim:no-statement-upload processes an imported statement without transmitting its rows", async ({ page }) => {
  const requests: { url: string; body: string | null }[] = [];
  page.on("request", (request) => requests.push({ url: request.url(), body: request.postData() }));
  await openDemo(page);
  await page.getByRole("button", { name: /Import another month/ }).click();
  await page.locator("#csv-file").setInputFiles({ name: "private.csv", mimeType: "text/csv", buffer: Buffer.from("Date,Description,Amount\n2026-08-01,PRIVATE-MERCHANT-92841,-12.00") });
  await page.getByRole("button", { name: /Import 1 rows/ }).click();
  expect(requests.every((request) => new URL(request.url).origin === new URL(page.url()).origin)).toBe(true);
  expect(JSON.stringify(requests)).not.toContain("PRIVATE-MERCHANT-92841");
});

test("@claim:source-csv-default-discard does not retain original CSV text unless selected", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: /Import another month/ }).click();
  await page.locator("#csv-file").setInputFiles({ name: "discard.csv", mimeType: "text/csv", buffer: Buffer.from("Date,Description,Amount\n2026-08-01,DISCARD SOURCE,-12.00") });
  await expect(page.locator('input[name="retain"]')).not.toBeChecked();
  await page.getByRole("button", { name: /Import 1 rows/ }).click();
  const stored = await readDatabase(page, "private-statement-review-demo") as { reviews: { filename: string; sourceCsv?: string }[] };
  expect(stored.reviews.find((review) => review.filename === "discard.csv")?.sourceCsv).toBeUndefined();
});

test("@claim:no-tracking runs the sample with no analytics or tracking request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await openDemo(page);
  await openTab(page, /Compare/);
  await page.waitForTimeout(300);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => new URL(url).origin !== origin)).toEqual([]);
});

test("@claim:license-token-only sends only the entered token during optional verification", async ({ page }) => {
  let requestUrl = "";
  let requestBody: string | null = "unexpected";
  await page.route("https://api.sociobot.in/**", async (route) => {
    requestUrl = route.request().url();
    requestBody = route.request().postData();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ valid: true, reason: "ok" }) });
  });
  await openDemo(page);
  await page.getByRole("button", { name: /Plus/ }).click();
  await page.locator("#license-token").fill("fixture-license-token");
  await page.getByRole("button", { name: "Verify license" }).click();
  await expect(page.locator("#license-status")).toContainText("verified");
  const url = new URL(requestUrl);
  expect([...url.searchParams.keys()]).toEqual(["license"]);
  expect(url.searchParams.get("license")).toBe("fixture-license-token");
  expect(requestBody).toBeNull();
});

test("@claim:no-advice-or-cloud-ai exports observations with a financial-advice warning and no model request", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await openDemo(page);
  await openTab(page, /Finish/);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export checklist" }).click();
  const text = await downloadText(await event);
  expect(text).toContain("this is not financial advice");
  expect(requests.some((url) => /openai|\/v1\/responses|\/chat\//i.test(url))).toBe(false);
});

test("@claim:free-core imports, compares, and exports without a license", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  expect(await page.evaluate(() => localStorage.getItem("sb_license:private-statement-review"))).toBeNull();
  await page.getByRole("button", { name: "Choose your CSV" }).click();
  await page.locator("#csv-file").setInputFiles({ name: "two-month.csv", mimeType: "text/csv", buffer: Buffer.from("Date,Description,Amount,Category\n2026-06-01,MARKET,-10,Groceries\n2026-07-01,MARKET,-15,Groceries") });
  await page.getByRole("button", { name: /Import 2 rows/ }).click();
  await openTab(page, /Compare/);
  await expect(page.getByRole("heading", { name: "July 2026 vs June 2026" })).toBeVisible();
  await openTab(page, /Finish/);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export transactions" }).click();
  expect(await downloadText(await event)).toContain("MARKET");
});

test("@claim:plus-price shows the US $19 one-time offer without a subscription or dead checkout", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".pricing")).toContainText("US $19");
  await expect(page.locator(".pricing")).toContainText("no subscription");
  await expect(page.locator(".pricing")).toContainText("Purchase registration is pending");
  await page.getByRole("button", { name: "Restore a license" }).click();
  await expect(page.locator("#plus-dialog")).toContainText("New purchases are temporarily unavailable");
  await expect(page.locator('#plus-dialog a[href*="checkout"]')).toHaveCount(0);
});

test("@claim:plus-source-retention keeps original CSV text only after explicit selection", async ({ page }) => {
  await openDemo(page);
  await page.getByRole("button", { name: /Import another month/ }).click();
  const raw = "Date,Description,Amount\n2026-08-01,RETAIN SOURCE,-12.00";
  await page.locator("#csv-file").setInputFiles({ name: "retain.csv", mimeType: "text/csv", buffer: Buffer.from(raw) });
  await page.locator('input[name="retain"]').check();
  await page.getByRole("button", { name: /Import 1 rows/ }).click();
  const stored = await readDatabase(page, "private-statement-review-demo") as { reviews: { filename: string; sourceCsv?: string }[] };
  expect(stored.reviews.find((review) => review.filename === "retain.csv")?.sourceCsv).toBe(raw);
});

test("@claim:plus-rule-limit saves more than five merchant rules in the Plus demo", async ({ page }) => {
  await openDemo(page);
  await openTab(page, /Tidy/);
  for (let index = 1; index <= 6; index += 1) {
    await page.locator('#rule-form input[name="match"]').fill(`MATCH ${index}`);
    await page.locator('#rule-form input[name="merchant"]').fill(`Merchant ${index}`);
    await page.getByRole("button", { name: "Save rule" }).click();
  }
  await expect(page.locator(".saved-rules li")).toHaveCount(6);
  await expect(page.locator("#rule-error")).toBeEmpty();
});

test("@claim:license-restore verifies and stores a license on another clean browser", async ({ page }) => {
  await page.route("https://api.sociobot.in/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ valid: true, reason: "ok" }) }));
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Plus/ }).click();
  await page.locator("#license-token").fill("restored-fixture-license");
  await page.getByRole("button", { name: "Verify license" }).click();
  await expect(page.locator(".license-active")).toContainText("Plus is active");
  expect(await page.evaluate(() => localStorage.getItem("sb_license:private-statement-review"))).toBe("restored-fixture-license");
});

test("@claim:self-hosted-runtime loads runtime code, fonts, images, and workers only from this origin", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/", { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const origin = new URL(page.url()).origin;
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.every((url) => new URL(url).origin === origin)).toBe(true);
  const loaded = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => entry.name));
  expect(loaded.every((url) => new URL(url).origin === origin)).toBe(true);
});
