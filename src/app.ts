import "./styles.css";
import { availableMonths, compareMonths, findRecurring, flattenTransactions, monthSummary } from "./analysis";
import { csvEscape, guessMapping, mapRows, parseCsv, type CsvTable } from "./csv";
import { clearData, discardDemoData, emptyData, loadData, saveData, type StorageMode } from "./db";
import { cachedUnlock, captureReturnedLicense, saveLicense, verifyLicense } from "./license";
import type { AppData, ChecklistItem, ColumnMapping, MerchantRule, Review, Transaction } from "./types";

type View = "home" | "import" | "review";
type Tab = "overview" | "tidy" | "recurring" | "compare" | "finish";
type Draft = CsvTable & { filename: string; raw: string; mapping: ColumnMapping; errors: string[] };

const rootElement = document.querySelector<HTMLDivElement>("#app");
if (!rootElement) throw new Error("App root is missing");
const root: HTMLDivElement = rootElement;

let data: AppData = emptyData();
let view: View = "home";
let tab: Tab = "overview";
let draft: Draft | null = null;
let loading = true;
const cleanPath = (): string => location.pathname.replace(/\/+$/, "") || "/";
const demoMode = cleanPath() === "/demo" || new URLSearchParams(location.search).get("demo") === "1";
const storageMode: StorageMode = demoMode ? "demo" : "real";
const themeKey = demoMode ? "demo:psr-theme" : "psr-theme";
let unlocked = demoMode || cachedUnlock(demoMode);
let notice = "";
let noticeTimer = 0;
let saveTimer = 0;
let acceptingUpdate = false;

const html = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[character] ?? character));

const amount = (value: number): string => new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(value);

const monthName = (month: string): string => new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${month}-01T00:00:00Z`));

const dateName = (date: string): string => new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  .format(new Date(`${date}T00:00:00Z`));

function announce(message: string): void {
  notice = message;
  renderNotice();
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => { notice = ""; renderNotice(); }, 4500);
}

function renderNotice(): void {
  const region = document.querySelector<HTMLElement>("#live-notice");
  if (region) {
    region.textContent = notice;
    region.classList.toggle("is-visible", Boolean(notice));
  }
}

function queueSave(message = "Saved on this device"): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void saveData(data, storageMode).then(() => announce(message)).catch((error: Error) => announce(error.message));
  }, 120);
}

function icon(name: "leaf" | "lock" | "moon" | "upload" | "check" | "arrow" | "plus" | "sun"): string {
  const paths = {
    leaf: '<path d="M20 4C12 4 6 8 5 16c4 1 8 0 11-3-2 3-5 5-9 6"/><path d="M5 20c2-6 6-9 11-12"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    moon: '<path d="M20 15.4A8 8 0 0 1 8.6 4 8 8 0 1 0 20 15.4Z"/>',
    upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 14v5h14v-5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>'
  };
  return `<svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`;
}

function header(): string {
  return `${demoMode ? demoBanner() : ""}<header class="site-header">
    <a class="brand" href="${demoMode ? "/demo/" : "/"}" aria-label="Private Statement Review home">
      <span class="brand-mark">${icon("moon")}</span><span>Private Statement<br><b>Review</b></span>
    </a>
    <nav aria-label="Primary">
      ${data.reviews.length ? '<button class="nav-action" data-action="dashboard">Your reviews</button>' : ''}
      <a class="demo-link" href="/demo/" ${demoMode ? 'aria-current="page"' : ""}>Demo</a>
      <a href="/privacy/${demoMode ? "?demo=1" : ""}">Privacy</a>
      <button class="icon-button" data-action="theme" aria-label="Switch color theme" title="Switch color theme">${icon("sun")}</button>
      <button class="button button-small button-quiet" data-action="plus">${icon("plus")} Plus</button>
    </nav>
  </header>`;
}

function demoBanner(): string {
  return `<aside class="demo-banner" aria-label="Demo controls"><strong>Demo — sample data, nothing is saved</strong><div><button data-action="reset-demo">Reset demo</button><button data-action="start-real">Start for real</button></div></aside>`;
}

function footer(): string {
  return `<footer class="site-footer">
    <p>${icon("lock")} Review downloaded bank CSVs in your browser.</p>
    <nav aria-label="Legal"><a href="/privacy/${demoMode ? "?demo=1" : ""}">Privacy</a><a href="/terms/${demoMode ? "?demo=1" : ""}">Terms</a><a href="https://github.com/B-Divyesh/sf-private-statement-review" target="_blank" rel="noreferrer">Source (external)</a></nav>
    <p class="generation-note">Built by Param Factory · v1.1.0 · Original generated artwork.</p>
  </footer>`;
}

function legalPage(kind: "privacy" | "terms"): string {
  const privacy = `<p class="eyebrow">Privacy</p><h1 tabindex="-1">How your statement data is handled</h1>
    <p class="lede">Your financial records are processed and stored on this device.</p>
    <section><h2>Statement data</h2><p>CSV parsing, merchant cleanup, repeat-charge checks, comparisons, notes, and exports happen in your browser.</p><p>Parsed rows use IndexedDB so your review survives a refresh. The app never sends these rows to Sociobot or analytics services.</p></section>
    <section><h2>Original CSV files</h2><p>The original file text is discarded after import by default.</p><p>Plus can retain the original text only when you select that option. It remains in this browser.</p></section>
    <section><h2>License checks</h2><p>A license check sends only your license token to the Sociobot billing API.</p><p>It does not include file names, amounts, merchants, categories, or notes.</p></section>
    <section><h2>Network use</h2><p>The app has no advertising, tracking, or behavioral analytics. It works offline after your first visit.</p><p>Do not include a statement when reporting a problem. Send only the app version and browser name.</p></section>
    <section><h2>Delete or copy your data</h2><p>Export a private backup before changing browsers or devices.</p><p>Use “Clear all local data” to erase reviews, rules, notes, and retained CSV text.</p></section>
    <section><h2>Contact</h2><p>Email <a href="mailto:privacy@sociobot.in">privacy@sociobot.in</a> with privacy questions. Last updated 6 September 2026.</p></section>`;
  const terms = `<p class="eyebrow">Terms</p><h1 tabindex="-1">Terms for using this review</h1>
    <p class="lede">Private Statement Review is a review aid. It is not a bank, accountant, or financial adviser.</p>
    <section><h2>Using the app</h2><p>Use only statements that you are allowed to access.</p><p>Check imported dates, amounts, mappings, repeat-charge candidates, and exports against the original statement.</p></section>
    <section><h2>No financial advice</h2><p>Summaries and changes are arithmetic observations. They are not financial, tax, credit, or investment advice.</p><p>A repeat-charge candidate can be wrong or incomplete. Contact the merchant or bank before acting.</p></section>
    <section><h2>Plus license</h2><p>Plus costs US $19 once for one person’s devices. There is no subscription.</p><p>It adds optional original-file retention and more than five merchant rules. The review and exports remain free.</p><p>Sociobot/Dodo handles checkout, receipts, and refunds. A refund revokes the license.</p></section>
    <section><h2>Your data and backups</h2><p>Browser settings, device loss, private browsing, or storage pressure can clear local data.</p><p>Keep your source statements and export backups that you need. We cannot recover local records.</p></section>
    <section><h2>Availability and liability</h2><p>The software is provided “as is” without warranties.</p><p>Where law permits, Sociobot is not liable for decisions based on output, missed transactions, or lost local data.</p></section>
    <section><h2>Changes and contact</h2><p>Email <a href="mailto:support@sociobot.in">support@sociobot.in</a> with questions. Last updated 6 September 2026.</p></section>`;
  return `${header()}<main id="main" tabindex="-1" class="legal-page">${kind === "privacy" ? privacy : terms}<a class="text-link back-link" href="${demoMode ? "/demo/" : "/"}">${icon("arrow")} Return to the review</a></main>${footer()}${dialogs()}${noticeRegion()}`;
}

function hero(): string {
  return `<main id="main" tabindex="-1">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Monthly bank CSV review</p>
        <h1 tabindex="-1">Review downloaded bank CSVs privately</h1>
        <p class="hero-lede">For households that want monthly cash-flow and repeat-charge checks without linking a bank account.</p>
        <div class="hero-actions">
          <button class="button button-primary" data-action="use-sample">Try it with sample data ${icon("arrow")}</button>
          <button class="button button-quiet" data-action="start-import">Choose your CSV</button>
        </div>
        <p class="action-note">The sample opens a ready two-month review.</p>
        <ul class="trust-list" aria-label="Product facts">
          <li>${icon("lock")} CSV rows stay in this browser</li>
          <li>${icon("moon")} Works offline after the first visit</li>
          <li>${icon("check")} Core review is free · Plus is US $19 once</li>
        </ul>
      </div>
      <figure class="hero-scene">
        <picture>
          <source type="image/avif" srcset="/art/ledger-garden-960.avif 960w, /art/ledger-garden-1536.avif 1536w" sizes="(max-width: 760px) 100vw, 58vw" />
          <source type="image/webp" srcset="/art/ledger-garden-960.webp 960w, /art/ledger-garden-1536.webp 1536w" sizes="(max-width: 760px) 100vw, 58vw" />
          <img src="/art/ledger-garden-1536.webp" srcset="/art/ledger-garden-960.webp 960w, /art/ledger-garden-1536.webp 1536w" sizes="(max-width: 760px) 100vw, 58vw" width="1536" height="1024" alt="A folded paper statement winding through a miniature moonlit garden" fetchpriority="high" decoding="async" />
        </picture>
        <figcaption>A private monthly review starts with a downloaded CSV.</figcaption>
      </figure>
    </section>
    <section class="product-preview" aria-labelledby="preview-title">
      <div class="preview-heading"><p class="eyebrow">Sample output</p><h2 id="preview-title">See cash flow and charges to check</h2><p>The sample compares June and July and flags repeated payments for review.</p></div>
      <div class="preview-sheet"><div><span>July money in</span><strong>3,200.00</strong></div><div><span>July money out</span><strong>522.79</strong></div><div><span>Possible repeats</span><strong>5</strong></div><ul><li>StreamCo · about monthly</li><li>City Transit · about weekly</li><li>Care Clinic · about fortnightly</li></ul></div>
    </section>
    <section class="how-it-works" aria-labelledby="how-title">
      <div><p class="eyebrow">How it works</p><h2 id="how-title">Finish a review in three steps</h2></div>
      <ol><li><span>01</span><h3>Import a CSV</h3><p>Match your bank’s date, description, and amount columns.</p></li><li><span>02</span><h3>Check changes</h3><p>Clean merchant names, review repeated charges, and compare months.</p></li><li><span>03</span><h3>Export your review</h3><p>Mark a checklist, add notes, and export your records.</p></li></ol>
    </section>
    <section class="boundaries" aria-labelledby="boundaries-title"><div><p class="eyebrow">Privacy and limits</p><h2 id="boundaries-title">What this review does not do</h2></div><ul><li>It does not connect to a bank or ask for bank credentials.</li><li>It does not upload statement rows or use cloud categorization.</li><li>It does not give financial, tax, credit, or investment advice.</li></ul></section>
    <section class="pricing" aria-labelledby="pricing-title"><div><p class="eyebrow">Plus</p><h2 id="pricing-title">Add two optional local tools</h2><p class="dialog-price"><strong>US $19</strong> once · no subscription</p><p>Keep an original CSV by choice and save more than five merchant rules. The review, checklist, comparisons, and exports stay free.</p></div><div class="pricing-actions"><button class="button button-secondary" data-action="plus">Restore a license</button><span class="registration-note" role="status">Purchase registration is pending. Free tools work now.</span></div></section>
  </main>`;
}

function notFoundPage(): string {
  return `${header()}<main id="main" tabindex="-1" class="not-found-page"><div class="not-found-mark" aria-hidden="true">404</div><p class="eyebrow">Page not found</p><h1 tabindex="-1">This page was not found</h1><p>Check the address, or return to the CSV review.</p><div class="hero-actions"><a class="button button-primary" href="/">Return home</a><a class="button button-quiet" href="/demo/">Open the sample</a></div></main>${footer()}${dialogs()}${noticeRegion()}`;
}

function optionList(headers: string[], selected: string, label = "Not used"): string {
  return `<option value="">${label}</option>${headers.map((header) => `<option value="${html(header)}" ${header === selected ? "selected" : ""}>${html(header)}</option>`).join("")}`;
}

function importView(): string {
  if (!draft) {
    return `<main id="main" tabindex="-1" class="import-page"><div class="step-heading"><p class="eyebrow">Step 1 · Import</p><h1 tabindex="-1">Import a bank CSV</h1><p>Choose a CSV from your bank. Your browser reads it without uploading it.</p></div>
      <section class="drop-zone" data-drop-zone>
        <div class="drop-moon">${icon("upload")}</div><h2>Drop your CSV here</h2><p>or choose it from this device</p>
        <label class="button button-primary" for="csv-file">Choose a CSV</label><input class="visually-hidden" id="csv-file" type="file" accept=".csv,text/csv" />
        <p class="fine-print">CSV only · up to 10 MB · file contents stay in this tab until you confirm</p>
      </section>
      <div class="import-help"><h2>Before you begin</h2><ul><li>Download a CSV, not a PDF.</li><li>Include date, description, and amount—or separate debit and credit columns.</li><li>Positive income and negative spending is preferred; separate debit/credit also works.</li></ul></div>
      <button class="text-button back-button" data-action="cancel-import">← Return to ${data.reviews.length ? "your reviews" : "the introduction"}</button>
    </main>`;
  }
  const currentDraft = draft;
  const mapping = currentDraft.mapping;
  const preview = currentDraft.rows.slice(0, 3);
  return `<main id="main" tabindex="-1" class="mapping-page"><div class="step-heading"><p class="eyebrow">Step 2 · Match columns</p><h1 tabindex="-1">Match your CSV columns</h1><p><strong>${html(currentDraft.filename)}</strong> has ${currentDraft.rows.length} data rows. Check the preview before importing.</p></div>
    <form id="mapping-form" class="mapping-form">
      <div class="mapping-fields">
        <label>Date column<select name="date" required>${optionList(draft.headers, mapping.date, "Choose a column")}</select></label>
        <label>Description / merchant<select name="description" required>${optionList(draft.headers, mapping.description, "Choose a column")}</select></label>
        <label>Single amount column<select name="amount">${optionList(draft.headers, mapping.amount)}</select><span class="field-note">Use this, or debit and credit below.</span></label>
        <label>Debit / money out<select name="debit">${optionList(draft.headers, mapping.debit)}</select></label>
        <label>Credit / money in<select name="credit">${optionList(draft.headers, mapping.credit)}</select></label>
        <label>Category (optional)<select name="category">${optionList(draft.headers, mapping.category)}</select></label>
        <label>Date order<select name="dateFormat"><option value="auto" ${mapping.dateFormat === "auto" ? "selected" : ""}>Detect from the whole statement</option><option value="mdy" ${mapping.dateFormat === "mdy" ? "selected" : ""}>Month / day / year</option><option value="dmy" ${mapping.dateFormat === "dmy" ? "selected" : ""}>Day / month / year</option><option value="ymd" ${mapping.dateFormat === "ymd" ? "selected" : ""}>Year / month / day</option></select><span class="field-note">If every numeric date could be either order, choose the order shown on your statement.</span></label>
        <label>Single amount sign<select name="amountDirection"><option value="expensesNegative" ${mapping.amountDirection !== "expensesPositive" ? "selected" : ""}>Negative means money out</option><option value="expensesPositive" ${mapping.amountDirection === "expensesPositive" ? "selected" : ""}>Positive means money out</option></select><span class="field-note">Ignored when debit/credit columns are used.</span></label>
      </div>
      <div class="preview-wrap" tabindex="0" role="region" aria-label="CSV preview"><table><caption>First ${preview.length} rows, shown exactly as read</caption><thead><tr>${currentDraft.headers.map((header) => `<th>${html(header)}</th>`).join("")}</tr></thead><tbody>${preview.map((row) => `<tr>${currentDraft.headers.map((header) => `<td>${html(row[header])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
      <label class="check-row ${!unlocked ? "is-locked" : ""}"><input type="checkbox" name="retain" ${!unlocked ? "disabled" : ""} /> <span><strong>Keep the original CSV on this device</strong><small>${unlocked ? "Optional. You can remove it later." : "Plus feature. Parsed review data is saved either way."}</small></span></label>
      <div id="mapping-error" class="form-error" role="alert"></div>
      <div class="form-actions"><button type="button" class="button button-quiet" data-action="discard-draft">Choose another file</button><button class="button button-primary" type="submit">Import ${currentDraft.rows.length} rows ${icon("arrow")}</button></div>
    </form></main>`;
}

function reviewNav(): string {
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" }, { id: "tidy", label: "Tidy" }, { id: "recurring", label: "Repeat charges" }, { id: "compare", label: "Compare" }, { id: "finish", label: "Finish" }
  ];
  return `<nav class="review-tabs" aria-label="Review steps">${tabs.map((item, index) => `<button data-tab="${item.id}" aria-current="${tab === item.id ? "step" : "false"}"><span>${String(index + 1).padStart(2, "0")}</span>${item.label}</button>`).join("")}</nav>`;
}

function summaryCards(transactions: Transaction[], month: string): string {
  const summary = monthSummary(transactions, month);
  return `<dl class="summary-strip"><div><dt>Money in</dt><dd>${amount(summary.income)}</dd></div><div><dt>Money out</dt><dd>${amount(summary.spending)}</dd></div><div class="${summary.net < 0 ? "negative" : "positive"}"><dt>Net</dt><dd>${summary.net >= 0 ? "+" : "−"}${amount(Math.abs(summary.net))}</dd></div></dl>`;
}

function overviewPanel(transactions: Transaction[], months: string[]): string {
  const current = months.at(-1) ?? "";
  const latest = transactions.filter((transaction) => transaction.date.startsWith(current));
  const reviewCount = data.reviews.length;
  return `<section class="panel" aria-labelledby="overview-title"><div class="panel-heading"><div><p class="eyebrow">Review summary</p><h2 id="overview-title">${current ? html(monthName(current)) : "Review overview"}</h2><p>${latest.length} transactions across ${reviewCount} imported ${reviewCount === 1 ? "file" : "files"}. Amounts use your statement’s currency.</p></div><button class="button button-primary" data-action="start-import">${icon("plus")} Import another month</button></div>
    ${summaryCards(transactions, current)}
    <div class="privacy-callout">${icon("lock")} <div><strong>Nothing was uploaded.</strong><span>This summary was calculated in your browser and saved only on this device.</span></div></div>
    <div class="overview-grid"><section><h3>Next useful checks</h3><ol class="next-steps"><li><span>1</span><div><strong>Clean merchant names</strong><p>Turn statement codes into names you recognize.</p><button class="text-button" data-tab="tidy">Open tidy-up →</button></div></li><li><span>2</span><div><strong>Look at repeat charges</strong><p>${findRecurring(transactions).length} candidates found from the dates and amounts available.</p><button class="text-button" data-tab="recurring">Review candidates →</button></div></li><li><span>3</span><div><strong>Compare months</strong><p>${months.length > 1 ? "Two or more months are ready." : "Import one more month to reveal changes."}</p><button class="text-button" data-tab="compare">View comparison →</button></div></li></ol></section>
    <section class="recent-files"><h3>Files reviewed</h3><ul>${data.reviews.slice().reverse().map((review) => `<li><span class="file-pin">${icon("check")}</span><div><strong>${html(review.filename)}</strong><small>${review.transactions.length} rows · ${new Date(review.importedAt).toLocaleDateString()}${review.sourceCsv ? " · original kept locally" : ""}</small></div></li>`).join("")}</ul></section></div></section>`;
}

function tidyPanel(transactions: Transaction[]): string {
  const uncategorized = transactions.filter((transaction) => transaction.category === "Uncategorized").length;
  const rows = transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80);
  return `<section class="panel" aria-labelledby="tidy-title"><div class="panel-heading"><div><p class="eyebrow">Step 2</p><h2 id="tidy-title">Clean merchant names and categories</h2><p>Merge coded descriptions under one merchant name, assign a category, or split a mixed purchase. ${uncategorized} remain uncategorized.</p></div></div>
    <form id="rule-form" class="rule-form"><h3>Add a merchant rule</h3><label>When description contains<input name="match" required maxlength="80" autocomplete="off" placeholder="e.g. STREAMCO*4432" /></label><label>Show as<input name="merchant" required maxlength="80" autocomplete="off" placeholder="e.g. StreamCo" /></label><label>Category<input name="category" maxlength="40" autocomplete="off" placeholder="e.g. Subscriptions" /></label><button class="button button-secondary" type="submit">Save rule</button><p class="field-note">${unlocked ? "Plus lets you save more than five rules." : `${data.rules.length}/5 free rules used. Plus lets you save more than five.`}</p><div id="rule-error" class="form-error" role="alert"></div></form>
    ${data.rules.length ? `<div class="saved-rules"><h3>Saved rules</h3><ul>${data.rules.map((rule) => `<li><span><b>Contains “${html(rule.match)}”</b> → ${html(rule.merchant)}${rule.category ? ` · ${html(rule.category)}` : ""}</span><button class="icon-button" data-remove-rule="${rule.id}" aria-label="Remove rule for ${html(rule.match)}">×</button></li>`).join("")}</ul></div>` : ""}
    <div class="transaction-list"><h3>Transactions</h3><p class="fine-print">Showing the newest ${rows.length}. Rules apply to all imported months.</p><div class="transaction-table">${rows.map((transaction) => `<article class="transaction-row" data-transaction="${transaction.id}"><div class="transaction-main"><time datetime="${transaction.date}">${html(dateName(transaction.date))}</time><div><strong>${html(transaction.merchant)}</strong><small title="Raw statement description">${html(transaction.description)}</small></div><span class="category-pill">${html(transaction.category)}</span><b class="transaction-amount ${transaction.amount < 0 ? "negative" : "positive"}">${transaction.amount < 0 ? "−" : "+"}${amount(Math.abs(transaction.amount))}</b></div><details><summary>Split or recategorize</summary><form class="transaction-edit-form" data-edit-transaction="${transaction.id}"><label>Category<input name="category" value="${html(transaction.category)}" maxlength="40" required /></label><div class="split-fields"><label>First part label<input name="label1" value="${html(transaction.splits[0]?.label ?? "")}" maxlength="40" /></label><label>Amount<input name="amount1" inputmode="decimal" value="${transaction.splits[0] ? amount(transaction.splits[0].amount) : ""}" /></label><label>Second part label<input name="label2" value="${html(transaction.splits[1]?.label ?? "")}" maxlength="40" /></label><label>Amount<input name="amount2" inputmode="decimal" value="${transaction.splits[1] ? amount(transaction.splits[1].amount) : ""}" /></label></div><p class="field-note">To split, both positive parts must add up to ${amount(Math.abs(transaction.amount))}.</p><div class="form-error" role="alert"></div><button class="button button-small button-secondary" type="submit">Save changes</button></form></details></article>`).join("")}</div></div></section>`;
}

function recurringPanel(transactions: Transaction[]): string {
  const candidates = findRecurring(transactions);
  return `<section class="panel" aria-labelledby="recurring-title"><div class="panel-heading"><div><p class="eyebrow">Step 3</p><h2 id="recurring-title">Review possible repeat charges</h2><p>These are candidates based on similar names, dates, and amounts. Check each against the original statement.</p></div></div>
    ${candidates.length ? `<div class="candidate-grid">${candidates.map((candidate) => `<article class="candidate"><div class="candidate-top"><span class="confidence ${candidate.confidence}">${candidate.confidence === "likely" ? "Likely repeat" : "Worth checking"}</span><span>${html(candidate.cadence)}</span></div><h3>${html(candidate.merchant)}</h3><p class="candidate-amount">~${amount(candidate.typicalAmount)} <small>per charge</small></p><details><summary>See ${candidate.transactions.length} matching charges</summary><ul>${candidate.transactions.map((transaction) => `<li><time>${html(dateName(transaction.date))}</time><b>${amount(Math.abs(transaction.amount))}</b></li>`).join("")}</ul></details><button class="button button-secondary" data-add-check="recurring" data-label="Check ${html(candidate.merchant)}" data-detail="${html(candidate.cadence)}, about ${amount(candidate.typicalAmount)}">Add to checklist</button></article>`).join("")}</div>` : `<div class="empty-state"><span class="empty-moons">◐ ◑</span><h3>No repeat pattern yet</h3><p>We need at least two matching charges with a regular interval. Import another month, or tidy merchant names so matches line up.</p><button class="button button-primary" data-action="start-import">Import another month</button></div>`}
  </section>`;
}

function comparePanel(transactions: Transaction[], months: string[]): string {
  if (months.length < 2) return `<section class="panel" aria-labelledby="compare-title"><div class="panel-heading"><div><p class="eyebrow">Step 4</p><h2 id="compare-title">Compare monthly spending</h2></div></div><div class="empty-state"><span class="empty-moons">◒</span><h3>Import one more month</h3><p>Import a CSV containing a different month. The review will compare spending categories.</p><button class="button button-primary" data-action="start-import">Import another month</button></div></section>`;
  const current = months.at(-1)!;
  const previous = months.at(-2)!;
  const changes = compareMonths(transactions, current, previous);
  const currentSummary = monthSummary(transactions, current);
  const previousSummary = monthSummary(transactions, previous);
  const max = Math.max(...changes.map((change) => Math.max(change.current, change.previous)), 1);
  return `<section class="panel" aria-labelledby="compare-title"><div class="panel-heading"><div><p class="eyebrow">Step 4</p><h2 id="compare-title">${html(monthName(current))} vs ${html(monthName(previous))}</h2><p>Largest category changes appear first. New categories are marked as new.</p></div></div>
    <div class="compare-summary"><div><span>${html(monthName(previous))}</span><b>${amount(previousSummary.spending)} out</b></div><span class="compare-arrow">→</span><div><span>${html(monthName(current))}</span><b>${amount(currentSummary.spending)} out</b></div><strong class="${currentSummary.spending > previousSummary.spending ? "negative" : "positive"}">${currentSummary.spending > previousSummary.spending ? "+" : "−"}${amount(Math.abs(currentSummary.spending - previousSummary.spending))}</strong></div>
    <div class="change-list">${changes.map((change) => {
      const percentText = change.percent === null ? "· new" : `· ${Math.abs(change.percent).toFixed(0)}% ${change.delta >= 0 ? "more" : "less"}`;
      return `<article class="change-row"><div class="change-copy"><h3>${html(change.category)}</h3><span class="${change.delta > 0 ? "negative" : change.delta < 0 ? "positive" : ""}">${change.delta > 0 ? "+" : change.delta < 0 ? "−" : ""}${amount(Math.abs(change.delta))} ${percentText}</span></div><div class="bars" aria-label="${html(change.category)}: ${amount(change.previous)} previously, ${amount(change.current)} currently"><span style="--bar:${(change.previous / max) * 100}%"><i>Previous</i></span><span class="current" style="--bar:${(change.current / max) * 100}%"><i>Current</i></span></div><button class="text-button" data-add-check="change" data-label="Review ${html(change.category)} change" data-detail="${change.delta >= 0 ? "+" : "−"}${amount(Math.abs(change.delta))} vs previous month">Add to checklist</button></article>`;
    }).join("")}</div>
  </section>`;
}

function finishPanel(): string {
  const items = data.reviews.flatMap((review) => review.checklist);
  const activeReview = data.reviews.at(-1);
  const done = items.filter((item) => item.done).length;
  return `<section class="panel" aria-labelledby="finish-title"><div class="panel-heading"><div><p class="eyebrow">Step 5</p><h2 id="finish-title">Finish and export your review</h2><p>${done} of ${items.length} checklist items are complete. The checklist and exports work without a network connection.</p></div></div>
    <div class="finish-grid"><section class="checklist"><h3>Your review checklist</h3>${items.length ? `<ul>${items.map((item) => `<li><label><input type="checkbox" data-check-item="${item.id}" ${item.done ? "checked" : ""} /><span><strong>${html(item.label)}</strong><small>${html(item.detail)}</small></span></label><button class="icon-button" data-remove-check="${item.id}" aria-label="Remove ${html(item.label)}">×</button></li>`).join("")}</ul>` : '<div class="mini-empty"><p>No items yet. Add candidates from Repeat charges or Compare, or write your own.</p></div>'}
      <form id="custom-check-form" class="custom-check"><label for="custom-check">Add your own check</label><div><input id="custom-check" name="label" maxlength="120" required placeholder="e.g. Ask about the duplicate café charge" /><button class="button button-secondary" type="submit">Add</button></div></form></section>
      <section class="review-note"><h3>Monthly note</h3><label for="review-notes">What did you notice?</label><textarea id="review-notes" rows="7" maxlength="2000" placeholder="A short note for next month…">${html(activeReview?.notes ?? "")}</textarea><p class="field-note">Saved only on this device.</p></section></div>
    <div class="export-block"><div><h3>Export your review</h3><p>The checklist is a Markdown file. You can also export transactions or a private backup.</p></div><div class="export-actions"><button class="button button-primary" data-action="export-checklist">Export checklist</button><button class="button button-secondary" data-action="export-csv">Export transactions</button><button class="button button-quiet" data-action="export-backup">Export private backup</button><label class="button button-quiet" for="backup-file">Import backup</label><input class="visually-hidden" id="backup-file" type="file" accept="application/json,.json" /></div></div>
    <div class="danger-zone"><div><h3>Clear local data</h3><p>Erase all imported rows, rules, notes, and any retained original files from this browser.</p></div><button class="button button-danger" data-action="confirm-clear">Clear all local data</button></div>
  </section>`;
}

function workspace(): string {
  const transactions = flattenTransactions(data.reviews, data.rules);
  const months = availableMonths(transactions);
  const panel = tab === "overview" ? overviewPanel(transactions, months)
    : tab === "tidy" ? tidyPanel(transactions)
      : tab === "recurring" ? recurringPanel(transactions)
        : tab === "compare" ? comparePanel(transactions, months) : finishPanel();
  return `<main id="main" tabindex="-1" class="workspace"><div class="workspace-title"><div><p class="eyebrow">Monthly CSV review</p><h1 tabindex="-1">Your statement review</h1></div><div class="local-badge">${icon("lock")} ${demoMode ? "Demo data" : "Stored locally"}</div></div>${reviewNav()}${panel}</main>`;
}

function plusDialog(): string {
  return `<dialog id="plus-dialog" class="dialog"><button class="dialog-close icon-button" data-action="close-plus" aria-label="Close Plus details">×</button><p class="eyebrow">Private Statement Review Plus</p><h2>Add optional local storage tools</h2><p class="dialog-price"><strong>US $19</strong> once · no subscription</p><ul class="feature-list"><li>${icon("check")} Keep an original CSV only when you choose</li><li>${icon("check")} Save more than five merchant cleanup rules</li><li>${icon("check")} Restore the license on your devices</li></ul><p>The review, comparisons, checklist, accessibility, and exports stay free.</p>${unlocked ? '<div class="license-active">✓ Plus is active on this device.</div>' : '<div class="registration-note">New purchases are temporarily unavailable while registration is completed.</div>'}<hr><form id="license-form"><label for="license-token">Have a license? Paste it here</label><div class="license-input"><input id="license-token" name="license" required autocomplete="off" spellcheck="false" /><button class="button button-secondary" type="submit">Verify license</button></div><div id="license-status" class="form-error" role="status" aria-live="polite"></div></form><p class="fine-print">Sociobot/Dodo is the merchant of record. <a href="/privacy/${demoMode ? "?demo=1" : ""}">Privacy</a> · <a href="/terms/${demoMode ? "?demo=1" : ""}">Terms</a></p></dialog>`;
}

function dialogs(): string {
  return `${plusDialog()}<dialog id="clear-dialog" class="dialog"><p class="eyebrow">This cannot be undone</p><h2>Clear every local review?</h2><p>This removes ${data.reviews.length} imported ${data.reviews.length === 1 ? "file" : "files"}, all transaction rows, merchant rules, notes, and retained CSV text from this browser. Your original files elsewhere are not affected.</p><div class="form-actions"><button class="button button-quiet" data-action="cancel-clear">Keep my data</button><button class="button button-danger" data-action="clear-all">Clear everything</button></div></dialog>`;
}

function noticeRegion(): string {
  return `<div id="route-announcer" class="visually-hidden" aria-live="polite"></div><div id="live-notice" class="toast" role="status" aria-live="polite">${html(notice)}</div><div id="network-status" class="network-status" role="status" aria-live="polite" hidden></div><div id="update-toast" class="update-toast" hidden><span>An app update is ready.</span><button class="button button-small button-secondary" data-action="update-app">Update now</button></div>`;
}

function setMetadata(title: string, description: string, path: string): void {
  document.title = title;
  const canonical = new URL(path, location.origin).href;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", canonical);
  document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute("content", title);
  document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute("content", description);
  document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute("content", canonical);
  document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute("content", title);
  document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute("content", description);
}

function render(): void {
  const path = cleanPath();
  const description = "Review downloaded bank CSVs for cash flow, repeated charges, and monthly changes without linking a bank account.";
  if (path === "/privacy") {
    setMetadata("Privacy — Private Statement Review", "Learn how Private Statement Review stores CSV rows and reviews in your browser.", "/privacy/");
    root.innerHTML = legalPage("privacy");
  } else if (path === "/terms") {
    setMetadata("Terms — Private Statement Review", "Read the terms for Private Statement Review and its optional one-time Plus license.", "/terms/");
    root.innerHTML = legalPage("terms");
  } else if (!["/", "/demo", "/404", "/404.html"].includes(path)) {
    setMetadata("Page not found — Private Statement Review", "Return to Private Statement Review or open its sample CSV review.", path);
    root.innerHTML = notFoundPage();
  } else if (path === "/404" || path === "/404.html") {
    setMetadata("Page not found — Private Statement Review", "Return to Private Statement Review or open its sample CSV review.", "/404.html");
    root.innerHTML = notFoundPage();
  } else if (loading) {
    setMetadata(demoMode ? "Demo — Private Statement Review" : "Private Statement Review — Review bank CSVs privately", description, demoMode ? "/demo/" : "/");
    root.innerHTML = `${demoMode ? demoBanner() : ""}<main id="main" tabindex="-1" class="loading-screen"><div class="loading-moon" aria-hidden="true"></div><h1 tabindex="-1">Opening ${demoMode ? "the sample review" : "your CSV review"}</h1><p>Reading only this browser.</p></main>${noticeRegion()}`;
  } else {
    setMetadata(demoMode ? "Demo — Private Statement Review" : "Private Statement Review — Review bank CSVs privately", description, demoMode ? "/demo/" : "/");
    root.innerHTML = `${header()}${view === "import" ? importView() : data.reviews.length && view === "review" ? workspace() : hero()}${footer()}${dialogs()}${noticeRegion()}`;
  }
  updateNetworkStatus();
}

function mappingFromForm(form: HTMLFormElement): ColumnMapping {
  const formData = new FormData(form);
  return {
    date: String(formData.get("date") ?? ""), description: String(formData.get("description") ?? ""), amount: String(formData.get("amount") ?? ""),
    debit: String(formData.get("debit") ?? ""), credit: String(formData.get("credit") ?? ""), category: String(formData.get("category") ?? ""),
    dateFormat: String(formData.get("dateFormat") ?? "auto") as ColumnMapping["dateFormat"],
    amountDirection: String(formData.get("amountDirection") ?? "expensesNegative") as ColumnMapping["amountDirection"]
  };
}

function makeChecklist(existingTransactions: Transaction[]): ChecklistItem[] {
  const recurring = findRecurring(existingTransactions).map((candidate) => ({ id: crypto.randomUUID(), label: `Check ${candidate.merchant}`, detail: `${candidate.cadence}, about ${amount(candidate.typicalAmount)}`, done: false, kind: "recurring" as const }));
  const months = availableMonths(existingTransactions);
  const changes = months.length > 1 ? compareMonths(existingTransactions, months.at(-1)!, months.at(-2)!).filter((change) => Math.abs(change.delta) >= 25).slice(0, 4).map((change) => ({ id: crypto.randomUUID(), label: `Review ${change.category} change`, detail: `${change.delta >= 0 ? "+" : "−"}${amount(Math.abs(change.delta))} vs previous month`, done: false, kind: "change" as const })) : [];
  return [...recurring, ...changes];
}

async function readCsvFile(file: File): Promise<void> {
  if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") { announce("Choose a CSV file."); return; }
  if (file.size > 10 * 1024 * 1024) { announce("That file is over 10 MB. Export a smaller date range and try again."); return; }
  try {
    const raw = await file.text();
    const table = parseCsv(raw);
    if (!table.rows.length) throw new Error("The CSV has headings but no transaction rows.");
    draft = { ...table, filename: file.name, raw, mapping: guessMapping(table.headers, data.mapping), errors: [] };
    view = "import";
    render();
  } catch (error) { announce(error instanceof Error ? error.message : "That CSV could not be read."); }
}

function findTransaction(id: string): Transaction | undefined {
  return data.reviews.flatMap((review) => review.transactions).find((transaction) => transaction.id === id);
}

function addChecklistItem(item: Omit<ChecklistItem, "id" | "done">): void {
  const review = data.reviews.at(-1);
  if (!review) return;
  if (data.reviews.some((entry) => entry.checklist.some((existing) => existing.label === item.label))) { announce("That check is already on your list."); return; }
  review.checklist.push({ ...item, id: crypto.randomUUID(), done: false });
  queueSave("Added to your checklist");
}

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportChecklist(): void {
  const transactions = flattenTransactions(data.reviews, data.rules);
  const months = availableMonths(transactions);
  const items = data.reviews.flatMap((review) => review.checklist);
  const notes = data.reviews.map((review) => review.notes.trim()).filter(Boolean);
  const content = [`# Private statement review${months.length ? ` — ${monthName(months.at(-1)!)}` : ""}`, "", "Amounts use the currency shown by the source statement.", "", "## Checklist", ...(items.length ? items.map((item) => `- [${item.done ? "x" : " "}] ${item.label}${item.detail ? ` — ${item.detail}` : ""}`) : ["- [ ] No checks added"]), "", "## Notes", ...(notes.length ? notes.map((note) => note) : ["No notes added."]), "", "Generated locally by Private Statement Review. Verify observations against the original statement; this is not financial advice.", ""].join("\n");
  download(`statement-review-${months.at(-1) ?? "checklist"}.md`, content, "text/markdown");
  announce("Checklist exported");
}

function exportCsv(): void {
  const rows = flattenTransactions(data.reviews, data.rules);
  const content = [["Date", "Description", "Merchant", "Category", "Amount"], ...rows.map((transaction) => [transaction.date, transaction.description, transaction.merchant, transaction.category, transaction.amount.toFixed(2)])].map((row) => row.map(csvEscape).join(",")).join("\n");
  download("private-statement-review-transactions.csv", content, "text/csv");
  announce("Transactions exported");
}

async function importBackup(file: File): Promise<void> {
  try {
    if (file.size > 20 * 1024 * 1024) throw new Error("That backup is over 20 MB. Choose a smaller Private Statement Review backup.");
    const parsed = JSON.parse(await file.text()) as AppData;
    const validTransaction = (item: Transaction) => item && typeof item.id === "string" && typeof item.date === "string" && typeof item.description === "string" && typeof item.merchant === "string" && typeof item.amount === "number" && Number.isFinite(item.amount) && typeof item.category === "string" && Array.isArray(item.splits);
    const validReview = (review: Review) => review && typeof review.id === "string" && typeof review.filename === "string" && Array.isArray(review.transactions) && review.transactions.every(validTransaction) && Array.isArray(review.checklist) && typeof review.notes === "string";
    const validRule = (rule: MerchantRule) => rule && typeof rule.id === "string" && typeof rule.match === "string" && typeof rule.merchant === "string" && typeof rule.category === "string";
    if (parsed.version !== 1 || !Array.isArray(parsed.reviews) || !parsed.reviews.every(validReview) || !Array.isArray(parsed.rules) || !parsed.rules.every(validRule)) throw new Error("This is not a valid Private Statement Review backup.");
    data = parsed;
    await saveData(data, storageMode);
    view = data.reviews.length ? "review" : "home";
    render();
    announce("Private backup imported");
  } catch (error) { announce(error instanceof Error ? error.message : "The backup could not be imported."); }
}

const SAMPLE_CSV = `Date,Description,Amount,Category
2026-06-03,ACME PAYROLL,3200.00,Income
2026-06-04,CITY TRANSIT,-22.50,Transport
2026-06-05,STREAMCO*1029,-14.99,Subscriptions
2026-06-06,FRESH MART,-84.40,Groceries
2026-06-11,CITY TRANSIT,-22.50,Transport
2026-06-13,CARE CLINIC,-65.00,Health
2026-06-18,CITY TRANSIT,-22.50,Transport
2026-06-18,CITY ENERGY,-91.20,Utilities
2026-06-25,CITY TRANSIT,-22.50,Transport
2026-06-27,CARE CLINIC,-65.00,Health
2026-07-02,CITY TRANSIT,-22.50,Transport
2026-07-03,ACME PAYROLL,3200.00,Income
2026-07-05,STREAMCO*4821,-14.99,Subscriptions
2026-07-09,CITY TRANSIT,-22.50,Transport
2026-07-09,FRESH MART,-112.70,Groceries
2026-07-11,CARE CLINIC,-65.00,Health
2026-07-16,CITY TRANSIT,-22.50,Transport
2026-07-18,CITY ENERGY,-128.60,Utilities
2026-07-22,CAFE AND BOOKS,-46.50,Uncategorized
2026-07-23,CITY TRANSIT,-22.50,Transport
2026-07-25,CARE CLINIC,-65.00,Health`;

function sampleData(): AppData {
  const table = parseCsv(SAMPLE_CSV);
  const mapping = guessMapping(table.headers);
  const result = mapRows(table.rows, mapping);
  const review: Review = {
    id: crypto.randomUUID(),
    filename: "sample-household-june-july.csv",
    importedAt: "2026-07-31T12:00:00.000Z",
    transactions: result.transactions,
    checklist: makeChecklist(result.transactions),
    notes: "Check the higher energy bill and the café purchase before closing July."
  };
  return { version: 1, reviews: [review], rules: [], mapping };
}

function useSample(): void {
  location.assign("/demo/");
}

function clearDemoPreferences(): void {
  [...Array(localStorage.length).keys()].map((index) => localStorage.key(index)).filter((key): key is string => Boolean(key?.startsWith("demo:"))).forEach((key) => localStorage.removeItem(key));
}

function updateNetworkStatus(): void {
  const status = document.querySelector<HTMLElement>("#network-status");
  if (!status) return;
  status.hidden = navigator.onLine;
  status.innerHTML = navigator.onLine ? "" : `${icon("moon")} Offline — this review still works`;
}

function focusPageHeading(): void {
  window.requestAnimationFrame(() => {
    const heading = document.querySelector<HTMLElement>("main h1");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: "start" });
    const announcer = document.querySelector<HTMLElement>("#route-announcer");
    if (announcer) announcer.textContent = heading?.textContent?.trim() ?? document.title;
  });
}

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest(".skip-link")) {
    event.preventDefault();
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>("#main")?.focus());
  }
});

root.addEventListener("click", (event) => {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
  if (!anchor || anchor.target || anchor.hasAttribute("download")) return;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return;
  const nextPath = url.pathname.replace(/\/+$/, "") || "/";
  const nextDemo = nextPath === "/demo" || url.searchParams.get("demo") === "1";
  if (nextDemo !== demoMode || !["/", "/demo", "/privacy", "/terms", "/404", "/404.html"].includes(nextPath)) return;
  event.preventDefault();
  history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  render();
  focusPageHeading();
});

window.addEventListener("popstate", () => { render(); focusPageHeading(); });

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLElement>("[data-action], [data-tab], [data-remove-rule], [data-add-check], [data-remove-check]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "start-import") { view = "import"; draft = null; render(); window.scrollTo(0, 0); focusPageHeading(); }
  if (action === "cancel-import" || action === "dashboard") { view = data.reviews.length ? "review" : "home"; draft = null; render(); focusPageHeading(); }
  if (action === "discard-draft") { draft = null; render(); }
  if (action === "use-sample") useSample();
  if (action === "theme") {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem(themeKey, next);
  }
  if (action === "reset-demo" && demoMode) {
    clearDemoPreferences();
    document.documentElement.dataset.theme = "auto";
    unlocked = true;
    data = sampleData();
    draft = null;
    view = "review";
    tab = "overview";
    void saveData(data, "demo").then(() => { render(); announce("Demo reset to the original sample"); });
  }
  if (action === "start-real" && demoMode) {
    clearDemoPreferences();
    void discardDemoData().then(() => location.assign("/"));
  }
  if (action === "plus") (document.querySelector("#plus-dialog") as HTMLDialogElement)?.showModal();
  if (action === "close-plus") (document.querySelector("#plus-dialog") as HTMLDialogElement)?.close();
  if (action === "confirm-clear") (document.querySelector("#clear-dialog") as HTMLDialogElement)?.showModal();
  if (action === "cancel-clear") (document.querySelector("#clear-dialog") as HTMLDialogElement)?.close();
  if (action === "clear-all") void clearData(storageMode).then(() => { data = demoMode ? sampleData() : emptyData(); view = demoMode ? "review" : "home"; draft = null; render(); announce(demoMode ? "Demo reset to the original sample" : "All review data was cleared from this browser"); });
  if (action === "export-checklist") exportChecklist();
  if (action === "export-csv") exportCsv();
  if (action === "export-backup") { download(`private-statement-review-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json"); announce("Private backup exported"); }
  if (action === "update-app") {
    acceptingUpdate = true;
    void navigator.serviceWorker?.getRegistration().then((registration) => registration?.waiting?.postMessage({ type: "SKIP_WAITING" }));
  }
  if (button.dataset.tab) { tab = button.dataset.tab as Tab; render(); document.querySelector(".panel")?.scrollIntoView({ block: "start" }); }
  if (button.dataset.removeRule) {
    const removed = data.rules.find((rule) => rule.id === button.dataset.removeRule);
    if (removed && !window.confirm(`Remove the rule for “${removed.match}”? Existing statement rows stay intact.`)) return;
    data.rules = data.rules.filter((rule) => rule.id !== button.dataset.removeRule);
    queueSave("Merchant rule removed"); render();
    if (removed) announce(`Removed rule for ${removed.match}`);
  }
  if (button.dataset.addCheck) {
    addChecklistItem({ kind: button.dataset.addCheck as ChecklistItem["kind"], label: button.dataset.label ?? "Review item", detail: button.dataset.detail ?? "" });
    button.textContent = "Added ✓";
  }
  if (button.dataset.removeCheck) {
    const item = data.reviews.flatMap((review) => review.checklist).find((entry) => entry.id === button.dataset.removeCheck);
    if (item && !window.confirm(`Remove “${item.label}” from this checklist?`)) return;
    data.reviews.forEach((review) => { review.checklist = review.checklist.filter((item) => item.id !== button.dataset.removeCheck); });
    queueSave("Checklist item removed"); render();
  }
});

root.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "csv-file" && target.files?.[0]) void readCsvFile(target.files[0]);
  if (target.id === "backup-file" && target.files?.[0]) void importBackup(target.files[0]);
  if (target.dataset.checkItem) {
    data.reviews.forEach((review) => review.checklist.forEach((item) => { if (item.id === target.dataset.checkItem) item.done = target.checked; }));
    queueSave(target.checked ? "Marked complete" : "Marked incomplete");
  }
});

root.addEventListener("input", (event) => {
  const target = event.target as HTMLTextAreaElement;
  if (target.id === "review-notes") {
    const review = data.reviews.at(-1);
    if (review) { review.notes = target.value; queueSave("Note saved on this device"); }
  }
});

root.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  if (form.id === "mapping-form" && draft) {
    try {
      const mapping = mappingFromForm(form);
      const result = mapRows(draft.rows, mapping);
      if (!result.transactions.length) throw new Error("No rows could be imported. Check the mapping and date order.");
      const allTransactions = [...flattenTransactions(data.reviews, data.rules), ...result.transactions];
      const formData = new FormData(form);
      const review: Review = { id: crypto.randomUUID(), filename: draft.filename, importedAt: new Date().toISOString(), transactions: result.transactions, checklist: makeChecklist(allTransactions), notes: "" };
      if (unlocked && formData.get("retain") === "on") review.sourceCsv = draft.raw;
      data.mapping = mapping;
      data.reviews.push(review);
      void saveData(data, storageMode).then(() => {
        const skipped = result.errors.length ? ` ${result.errors.length} unreadable ${result.errors.length === 1 ? "row was" : "rows were"} skipped.` : "";
        draft = null; view = "review"; tab = "overview"; render(); announce(`${result.transactions.length} transactions imported.${skipped}`);
      });
    } catch (error) {
      const region = form.querySelector<HTMLElement>("#mapping-error");
      if (region) region.textContent = error instanceof Error ? error.message : "The rows could not be imported.";
    }
  }
  if (form.id === "rule-form") {
    const error = form.querySelector<HTMLElement>("#rule-error");
    if (!unlocked && data.rules.length >= 5) { if (error) error.textContent = "The free rule library holds five rules. Plus removes this limit."; return; }
    const values = new FormData(form);
    const match = String(values.get("match") ?? "").trim();
    const merchant = String(values.get("merchant") ?? "").trim();
    if (!match || !merchant) return;
    const rule: MerchantRule = { id: crypto.randomUUID(), match, merchant, category: String(values.get("category") ?? "").trim() };
    data.rules.push(rule); queueSave("Merchant rule saved"); render();
  }
  if (form.dataset.editTransaction) {
    const transaction = findTransaction(form.dataset.editTransaction);
    if (!transaction) return;
    const values = new FormData(form);
    const category = String(values.get("category") ?? "").trim();
    const label1 = String(values.get("label1") ?? "").trim();
    const label2 = String(values.get("label2") ?? "").trim();
    const amount1 = Number(String(values.get("amount1") ?? "").replaceAll(",", ""));
    const amount2 = Number(String(values.get("amount2") ?? "").replaceAll(",", ""));
    const error = form.querySelector<HTMLElement>(".form-error");
    if ((label1 || label2) && (!label1 || !label2 || !Number.isFinite(amount1) || !Number.isFinite(amount2) || amount1 <= 0 || amount2 <= 0 || Math.abs(amount1 + amount2 - Math.abs(transaction.amount)) > 0.01)) {
      if (error) error.textContent = `Enter two positive parts that total ${amount(Math.abs(transaction.amount))}.`;
      return;
    }
    transaction.category = category;
    transaction.splits = label1 && label2 ? [{ id: crypto.randomUUID(), label: label1, amount: amount1 }, { id: crypto.randomUUID(), label: label2, amount: amount2 }] : [];
    queueSave("Transaction changes saved"); render();
  }
  if (form.id === "custom-check-form") {
    const label = String(new FormData(form).get("label") ?? "").trim();
    if (label) { addChecklistItem({ kind: "custom", label, detail: "Added by you" }); render(); }
  }
  if (form.id === "license-form") {
    const token = String(new FormData(form).get("license") ?? "").trim();
    const status = form.querySelector<HTMLElement>("#license-status");
    if (!token) return;
    saveLicense(token, demoMode);
    if (status) status.textContent = "Checking license…";
    void verifyLicense(true, demoMode).then((result) => {
      unlocked = result.valid;
      if (status) status.textContent = result.valid ? "License verified. Plus is active." : `License not active (${result.reason.replaceAll("_", " ")}).`;
      if (result.valid) window.setTimeout(render, 900);
    }).catch(() => { if (status) status.textContent = "Could not reach the license service. Try again when online."; });
  }
});

root.addEventListener("dragover", (event) => { if ((event.target as HTMLElement).closest("[data-drop-zone]")) { event.preventDefault(); (event.target as HTMLElement).closest("[data-drop-zone]")?.classList.add("is-dragging"); } });
root.addEventListener("dragleave", (event) => (event.target as HTMLElement).closest("[data-drop-zone]")?.classList.remove("is-dragging"));
root.addEventListener("drop", (event) => {
  const zone = (event.target as HTMLElement).closest("[data-drop-zone]");
  if (!zone) return;
  event.preventDefault(); zone.classList.remove("is-dragging");
  const file = event.dataTransfer?.files[0];
  if (file) void readCsvFile(file);
});

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
  void navigator.serviceWorker.register("/sw.js").then((registration) => {
    if (registration.waiting) document.querySelector<HTMLElement>("#update-toast")!.hidden = false;
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          const toast = document.querySelector<HTMLElement>("#update-toast");
          if (toast) toast.hidden = false;
        }
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (acceptingUpdate) location.reload(); });
  }).catch(() => { /* app remains usable without installation */ });
}

document.documentElement.dataset.theme = localStorage.getItem(themeKey) ?? "auto";
captureReturnedLicense(demoMode);
unlocked = demoMode || cachedUnlock(demoMode);
render();
void loadData(storageMode).then(async (stored) => {
  data = demoMode && !stored.reviews.length ? sampleData() : stored;
  if (demoMode && !stored.reviews.length) await saveData(data, "demo");
  loading = false;
  view = data.reviews.length ? "review" : "home";
  render();
  registerServiceWorker();
  if (!demoMode && unlocked && navigator.onLine) void verifyLicense(false, false).then((result) => {
    if (!result.valid) { unlocked = false; render(); announce("Your Plus license is no longer active. The free review remains available."); }
  }).catch(() => { /* cached access remains available offline */ });
}).catch((error: Error) => { loading = false; render(); announce(error.message); });
