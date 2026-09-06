import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

const baseUrl = process.env.PSR_TEST_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const errors = [];

const watchErrors = (page) => {
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
};

const assertAxe = async (page, name) => {
  const result = await new AxeBuilder({ page }).analyze();
  const serious = result.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""));
  assert.equal(serious.length, 0, `${name}: ${JSON.stringify(serious, null, 2)}`);
};

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  watchErrors(page);
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(await page.title(), "Private Statement Review — Review bank CSVs privately");
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("main").count(), 1);
  assert.equal(await page.locator("img:not([alt])").count(), 0);
  assert.match(await page.locator("h1").innerText(), /Review downloaded bank CSVs privately/);
  assert.match(await page.locator(".hero-lede").innerText(), /households/);
  assert.equal(await page.getByRole("button", { name: /Try it with sample data/ }).isVisible(), true);
  for (const selector of ['link[rel="canonical"]', 'meta[property="og:title"]', 'meta[property="og:image"]', 'meta[name="twitter:card"]']) {
    assert.equal(await page.locator(selector).count(), 1, `${selector} must exist`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal(await page.locator("body").evaluate((body) => body.scrollWidth <= document.documentElement.clientWidth), true);
  await assertAxe(page, "desktop landing");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator("body").evaluate((body) => body.scrollWidth <= document.documentElement.clientWidth), true);
  const footerTargets = await page.locator(".site-footer nav a").evaluateAll((links) => links.map((link) => {
    const rect = link.getBoundingClientRect();
    return { text: link.textContent?.trim(), width: rect.width, height: rect.height };
  }));
  assert.deepEqual(footerTargets.map((target) => target.text), ["Privacy", "Terms", "Source (external)"]);
  assert.equal(footerTargets.every((target) => target.width >= 44 && target.height >= 44), true, JSON.stringify(footerTargets));
  await page.keyboard.press("Tab");
  assert.equal((await page.locator(":focus").textContent())?.trim(), "Skip to review");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => document.activeElement?.id), "main");
  await assertAxe(page, "phone landing");

  await page.getByRole("button", { name: /Try it with sample data/ }).click();
  await page.getByRole("heading", { name: "Your statement review" }).waitFor();
  assert.equal(new URL(page.url()).pathname, "/demo/");
  assert.equal(await page.getByText("Demo — sample data, nothing is saved").isVisible(), true);
  assert.match(await page.locator(".summary-strip").innerText(), /522.79/);
  assert.match(await page.locator("main").innerText(), /sample-household-june-july.csv/);

  await page.getByRole("button", { name: /Repeat charges/ }).click();
  assert.match(await page.locator("main").innerText(), /about weekly/);
  await page.locator('[data-add-check="recurring"]').first().click();
  await page.getByRole("button", { name: /Compare/ }).click();
  assert.match(await page.locator("main").innerText(), /July 2026 vs June 2026/);
  await page.getByRole("button", { name: /Finish/ }).click();
  const checklistDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export checklist" }).click();
  assert.match((await checklistDownload).suggestedFilename(), /^statement-review-.*\.md$/);
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export transactions" }).click();
  assert.equal((await csvDownload).suggestedFilename(), "private-statement-review-transactions.csv");
  await assertAxe(page, "demo workspace");
  await page.getByRole("button", { name: /Plus/ }).click();
  assert.match(await page.locator("#plus-dialog").innerText(), /US \$19/);
  assert.equal(await page.locator('#plus-dialog a[href*="checkout"]').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("aria-label")), "Close Plus details");
  const dialogLinks = await page.locator("#plus-dialog .fine-print a").evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
  assert.equal(dialogLinks.every((height) => height >= 44), true, JSON.stringify(dialogLinks));
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#plus-dialog").evaluate((dialog) => dialog.hasAttribute("open")), false);

  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await assertAxe(page, "dark demo");
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });

  for (const [path, title, heading] of [
    ["/privacy/", "Privacy — Private Statement Review", "How your statement data is handled"],
    ["/terms/", "Terms — Private Statement Review", "Terms for using this review"]
  ]) {
    const legal = await context.newPage();
    watchErrors(legal);
    await legal.goto(`${baseUrl}${path}`, { waitUntil: "networkidle" });
    assert.equal(await legal.title(), title);
    assert.equal(await legal.getByRole("heading", { name: heading }).count(), 1);
    const links = await legal.locator(".legal-page p a").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
    assert.equal(links.every((height) => height >= 44), true, JSON.stringify(links));
    await assertAxe(legal, path);
    await legal.close();
  }

  const missing = await context.newPage();
  watchErrors(missing);
  const missingResponse = await missing.goto(`${baseUrl}/reviewer-missing-route-20260906`, { waitUntil: "networkidle" });
  if (baseUrl.startsWith("https://")) assert.equal(missingResponse?.status(), 404);
  assert.equal(await missing.title(), "Page not found — Private Statement Review");
  assert.equal(await missing.getByRole("heading", { name: "This page was not found" }).count(), 1);
  assert.equal(await missing.getByRole("link", { name: "Return home" }).isVisible(), true);
  await assertAxe(missing, "404");
  await missing.close();

  const recovery = await context.newPage();
  watchErrors(recovery);
  await recovery.goto(baseUrl, { waitUntil: "networkidle" });
  await recovery.getByRole("button", { name: "Choose your CSV" }).click();
  await recovery.locator("#csv-file").setInputFiles({ name: "statement.txt", mimeType: "text/plain", buffer: Buffer.from("not csv") });
  assert.match(await recovery.locator("#live-notice").innerText(), /Choose a CSV file/);
  await recovery.locator("#csv-file").setInputFiles({ name: "empty.csv", mimeType: "text/csv", buffer: Buffer.from("Date,Description,Amount") });
  assert.match(await recovery.locator("#live-notice").innerText(), /no transaction rows/);
  await recovery.locator("#csv-file").setInputFiles({ name: "broken.csv", mimeType: "text/csv", buffer: Buffer.from('Date,Description,Amount\n2026-01-01,"broken,-1') });
  assert.match(await recovery.locator("#live-notice").innerText(), /unclosed quoted field/);
  await recovery.locator("#csv-file").setInputFiles({ name: "large.csv", mimeType: "text/csv", buffer: Buffer.alloc(10 * 1024 * 1024 + 1, 65) });
  assert.match(await recovery.locator("#live-notice").innerText(), /over 10 MB/);
  await recovery.locator("#csv-file").setInputFiles({ name: "ambiguous.csv", mimeType: "text/csv", buffer: Buffer.from("Date,Description,Amount\n04/03/2026,MARKET,-20") });
  await recovery.getByRole("button", { name: /Import 1 rows/ }).click();
  assert.match(await recovery.locator("#mapping-error").innerText(), /Check the mapping and date order/);
  await recovery.locator('select[name="dateFormat"]').selectOption("dmy");
  await recovery.getByRole("button", { name: /Import 1 rows/ }).click();
  await recovery.getByRole("heading", { name: "Your statement review" }).waitFor();
  await recovery.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  assert.equal(await recovery.locator("body").evaluate((body) => body.scrollWidth <= document.documentElement.clientWidth), true);
  await recovery.close();
  await context.close();

  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  const reducedPage = await reduced.newPage();
  watchErrors(reducedPage);
  await reducedPage.goto(baseUrl, { waitUntil: "networkidle" });
  const animationDuration = await reducedPage.locator(".hero-scene").evaluate((element) => window.getComputedStyle(element).animationDuration);
  assert.ok(["0s", "0.00001s", "1e-05s"].includes(animationDuration), animationDuration);
  await reduced.close();

  const offline = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const offlinePage = await offline.newPage();
  watchErrors(offlinePage);
  await offlinePage.goto(`${baseUrl}/demo/`, { waitUntil: "networkidle" });
  await offlinePage.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await offlinePage.reload({ waitUntil: "networkidle" });
  await offline.setOffline(true);
  await offlinePage.reload({ waitUntil: "domcontentloaded" });
  await offlinePage.getByRole("heading", { name: "Your statement review" }).waitFor({ timeout: 8_000 });
  assert.equal(await offlinePage.locator("#network-status").isVisible(), true);
  await offline.close();

  assert.deepEqual(errors, []);
  console.log("Browser verification passed: job-first landing, isolated demo, keyboard, routes, 404, Axe, reduced motion, exports, and offline reload.");
} finally {
  await browser.close();
}
