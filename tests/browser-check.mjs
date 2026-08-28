import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";

const baseUrl = process.env.PSR_TEST_URL ?? "http://127.0.0.1:4173";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert.match(await page.title(), /Private Statement Review/);
  assert.equal(await page.locator("h1").count(), 1);
  assert.equal(await page.locator("main").count(), 1);
  assert.equal(await page.locator("img:not([alt])").count(), 0);
  assert.equal(await page.locator("body").evaluate((body) => body.scrollWidth <= document.documentElement.clientWidth), true, "390px layout must not overflow horizontally");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").textContent(), "Skip to review");
  const landingA11y = await new AxeBuilder({ page }).analyze();
  assert.equal(landingA11y.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).length, 0, JSON.stringify(landingA11y.violations, null, 2));

  await page.getByRole("button", { name: /Plus/ }).click();
  assert.match(await page.locator("#plus-dialog").textContent(), /US \$19/);
  assert.equal(await page.getByRole("link", { name: /Buy Plus securely/ }).getAttribute("href"), "https://api.sociobot.in/api/v1/products/private-statement-review/checkout");
  await page.getByRole("button", { name: "Close Plus details" }).click();

  await page.getByRole("button", { name: "Try a safe sample" }).click();
  await page.getByRole("heading", { name: /which columns/i }).waitFor();
  assert.equal(await page.locator('select[name="date"]').inputValue(), "Date");
  await page.getByRole("button", { name: /Import 9 rows/ }).click();
  await page.getByRole("heading", { name: "Your statement review" }).waitFor();
  assert.match(await page.locator("main").textContent(), /Nothing was uploaded/);

  await page.getByRole("button", { name: /Repeat charges/ }).click();
  assert.match(await page.locator("main").textContent(), /STREAMCO/);
  await page.locator('[data-add-check="recurring"]').first().click();
  await page.getByRole("button", { name: /Compare/ }).click();
  assert.match(await page.locator("main").textContent(), /July 2026 vs June 2026/);
  await page.getByRole("button", { name: /Finish/ }).click();
  assert.match(await page.locator("main").textContent(), /Check STREAMCO/);
  const checklistDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export checklist" }).click();
  assert.match((await checklistDownload).suggestedFilename(), /^statement-review-.*\.md$/);
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export transactions" }).click();
  assert.equal((await csvDownload).suggestedFilename(), "private-statement-review-transactions.csv");
  await page.waitForTimeout(250);

  const workspaceA11y = await new AxeBuilder({ page }).analyze();
  assert.equal(workspaceA11y.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).length, 0, JSON.stringify(workspaceA11y.violations, null, 2));
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await page.waitForTimeout(250);
  const darkA11y = await new AxeBuilder({ page }).analyze();
  assert.equal(darkA11y.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? "")).length, 0, JSON.stringify(darkA11y.violations, null, 2));
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });

  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload({ waitUntil: "networkidle" });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  try {
    await page.getByRole("heading", { name: "Your statement review" }).waitFor({ timeout: 8000 });
  } catch {
    throw new Error(`Offline workspace did not restore. Visible page: ${await page.locator("body").innerText()}`);
  }
  assert.equal(await page.locator("#network-status").isVisible(), true, "offline state should be visible");

  await context.setOffline(false);
  const privacy = await context.newPage();
  await privacy.goto(`${baseUrl}/privacy/`, { waitUntil: "networkidle" });
  assert.equal(await privacy.locator("h1").count(), 1);
  assert.match(await privacy.locator("main").textContent(), /never sent to Sociobot/);
  await privacy.close();

  assert.deepEqual(consoleErrors, []);
  console.log("Browser verification passed: mobile, sample flow, accessibility, persistence, offline reload, legal route, and console.");
} finally {
  await browser.close();
}
