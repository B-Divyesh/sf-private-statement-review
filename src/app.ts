import "./styles.css";
import { availableMonths, compareMonths, findRecurring, flattenTransactions, monthSummary } from "./analysis";
import { csvEscape, guessMapping, mapRows, parseCsv, type CsvTable } from "./csv";
import { clearData, emptyData, loadData, saveData } from "./db";
import { cachedUnlock, captureReturnedLicense, checkoutUrl, saveLicense, verifyLicense } from "./license";
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
let unlocked = cachedUnlock();
let notice = "";
let noticeTimer = 0;
let saveTimer = 0;

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
    void saveData(data).then(() => announce(message)).catch((error: Error) => announce(error.message));
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
  return `<header class="site-header">
    <a class="brand" href="/" aria-label="Private Statement Review home">
      <span class="brand-mark">${icon("moon")}</span><span>Private Statement<br><b>Review</b></span>
    </a>
    <nav aria-label="Primary">
      ${data.reviews.length ? '<button class="nav-action" data-action="dashboard">Your reviews</button>' : ''}
      <a href="/privacy/">Privacy</a>
      <button class="icon-button" data-action="theme" aria-label="Switch color theme" title="Switch color theme">${icon("sun")}</button>
      <button class="button button-small button-quiet" data-action="plus">${icon("plus")} Plus</button>
    </nav>
  </header>`;
}

function footer(): string {
  return `<footer class="site-footer">
    <p>${icon("lock")} Your statements stay in this browser.</p>
    <nav aria-label="Legal"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><a href="https://github.com/B-Divyesh/sf-private-statement-review">Source</a></nav>
    <p class="generation-note">Original hero artwork generated for this product.</p>
  </footer>`;
}

function legalPage(kind: "privacy" | "terms"): string {
  const privacy = `<p class="eyebrow">Plain-language privacy</p><h1>What stays private</h1>
    <p class="lede">Your financial records are processed and stored on this device. We designed the product so there is no statement server to trust.</p>
    <section><h2>Statement data</h2><p>CSV parsing, merchant cleanup, recurring-charge detection, comparisons, notes, and exports happen inside your browser. Statement rows are saved in IndexedDB on this device so your review survives a refresh. They are never sent to Sociobot or an analytics service.</p></section>
    <section><h2>Original CSV files</h2><p>The original file text is not retained by default. If you have a Plus license, you may explicitly choose “Keep the original CSV on this device” during import. It still stays in browser storage and can be deleted at any time.</p></section>
    <section><h2>License checks</h2><p>If you buy or restore Plus, only the license token is sent to the Sociobot billing API to verify access. Your statement data, file names, totals, categories, and notes are not included. Sociobot/Dodo is the merchant of record and processes checkout separately.</p></section>
    <section><h2>Network and diagnostics</h2><p>The app has no advertising trackers and no behavioral analytics. It works offline after the first visit. If you report a problem, do not include a statement; diagnostics should contain app version and browser information only, never file names, merchants, dates, or values.</p></section>
    <section><h2>Your controls</h2><p>Use “Export private backup” to take a copy and “Clear all local data” to erase reviews, rules, and notes from this browser. Clearing site data in your browser does the same. A stored license uses localStorage and can be removed by clearing site data.</p></section>
    <section><h2>Contact</h2><p>Privacy questions: <a href="mailto:privacy@sociobot.in">privacy@sociobot.in</a>. Last updated 28 August 2026.</p></section>`;
  const terms = `<p class="eyebrow">Fair-use terms</p><h1>Terms of use</h1>
    <p class="lede">Private Statement Review is a review aid, not a financial adviser, bank, accountant, or guarantee of detecting every charge.</p>
    <section><h2>Using the app</h2><p>You may use the app with statement files you are authorized to access. You are responsible for checking imported dates, signs, mappings, recurring candidates, and exported notes against the original statement before acting.</p></section>
    <section><h2>No financial advice</h2><p>Summaries and change flags are arithmetic observations, not individualized financial, tax, credit, or investment advice. A recurring candidate can be a false positive or miss a charge. Contact the relevant merchant or institution to confirm a transaction.</p></section>
    <section><h2>Plus purchase</h2><p>Plus is a US $19 one-time license for one person’s devices. It unlocks optional original-file retention and more than five saved merchant rules. Core review and exports remain free. Sociobot/Dodo is the merchant of record; checkout, receipts, and refunds are handled there. A refund revokes the license.</p></section>
    <section><h2>Your data and backups</h2><p>Local browser storage can be cleared by browser settings, device loss, private browsing, or storage pressure. Keep your source statements and export backups you need. We cannot recover local records.</p></section>
    <section><h2>Availability and liability</h2><p>The software is provided “as is” without warranties. To the extent permitted by law, Sociobot is not liable for decisions made from its output, missed transactions, or loss of local data. Nothing here limits rights that cannot legally be limited.</p></section>
    <section><h2>Changes and contact</h2><p>Material changes will be dated here. Questions: <a href="mailto:support@sociobot.in">support@sociobot.in</a>. Last updated 28 August 2026.</p></section>`;
  return `${header()}<main id="main" class="legal-page">${kind === "privacy" ? privacy : terms}<a class="text-link back-link" href="/">${icon("arrow")} Return to the review</a></main>${footer()}${dialogs()}${noticeRegion()}`;
}

function hero(): string {
  return `<main id="main">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">No bank link · no upload · works offline</p>
        <h1>See what changed.<br><em>Keep it to yourself.</em></h1>
        <p class="hero-lede">Turn a downloaded bank CSV into a clear monthly review—cash flow, repeat charges, and category shifts—entirely in your browser.</p>
        <div class="hero-actions">
          <button class="button button-primary" data-action="start-import">Review a statement ${icon("arrow")}</button>
          <button class="text-button" data-action="use-sample">Try a safe sample</button>
        </div>
        <ul class="trust-list" aria-label="Privacy promises">
          <li>${icon("lock")} Statement rows never leave your device</li>
          <li>${icon("check")} No account or bank credentials</li>
          <li>${icon("moon")} Ready for the next month, offline</li>
        </ul>
      </div>
      <figure class="hero-scene">
        <picture>
          <source media="(max-width: 700px)" srcset="/art/ledger-garden-960.webp" />
          <img src="/art/ledger-garden-1536.webp" srcset="/art/ledger-garden-960.webp 960w, /art/ledger-garden-1536.webp 1536w" sizes="(max-width: 760px) 100vw, 58vw" width="1536" height="1024" alt="A folded paper statement winding through a miniature moonlit garden" fetchpriority="high" decoding="async" />
        </picture>
        <figcaption><span>01</span> A monthly ritual, not another budget to maintain.</figcaption>
      </figure>
    </section>
    <section class="how-it-works" aria-labelledby="how-title">
      <div><p class="eyebrow">A smaller, calmer tool</p><h2 id="how-title">From download to done in four chapters</h2></div>
      <ol><li><span>01</span><h3>Bring a CSV</h3><p>Map familiar columns once. Common bank headings are detected.</p></li><li><span>02</span><h3>Tidy merchants</h3><p>Merge cryptic descriptions and split mixed purchases on your terms.</p></li><li><span>03</span><h3>Notice patterns</h3><p>Review likely repeat charges and category changes, with the evidence beside them.</p></li><li><span>04</span><h3>Carry a checklist</h3><p>Mark what you checked, add a note, and export a plain-text record.</p></li></ol>
    </section>
  </main>`;
}

function optionList(headers: string[], selected: string, label = "Not used"): string {
  return `<option value="">${label}</option>${headers.map((header) => `<option value="${html(header)}" ${header === selected ? "selected" : ""}>${html(header)}</option>`).join("")}`;
}

function importView(): string {
  if (!draft) {
    return `<main id="main" class="import-page"><div class="chapter-heading"><p class="eyebrow">Chapter 01 · Import</p><h1>Bring one statement home</h1><p>Choose a comma-separated CSV from your bank. It will be read here, not uploaded.</p></div>
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
  return `<main id="main" class="mapping-page"><div class="chapter-heading"><p class="eyebrow">Chapter 02 · Map</p><h1>Tell us which columns are which</h1><p><strong>${html(currentDraft.filename)}</strong> has ${currentDraft.rows.length} data rows. Check the preview before importing.</p></div>
    <form id="mapping-form" class="mapping-form">
      <div class="mapping-fields">
        <label>Date column<select name="date" required>${optionList(draft.headers, mapping.date, "Choose a column")}</select></label>
        <label>Description / merchant<select name="description" required>${optionList(draft.headers, mapping.description, "Choose a column")}</select></label>
        <label>Single amount column<select name="amount">${optionList(draft.headers, mapping.amount)}</select><span class="field-note">Use this, or debit and credit below.</span></label>
        <label>Debit / money out<select name="debit">${optionList(draft.headers, mapping.debit)}</select></label>
        <label>Credit / money in<select name="credit">${optionList(draft.headers, mapping.credit)}</select></label>
        <label>Category (optional)<select name="category">${optionList(draft.headers, mapping.category)}</select></label>
        <label>Date order<select name="dateFormat"><option value="auto" ${mapping.dateFormat === "auto" ? "selected" : ""}>Detect automatically</option><option value="mdy" ${mapping.dateFormat === "mdy" ? "selected" : ""}>Month / day / year</option><option value="dmy" ${mapping.dateFormat === "dmy" ? "selected" : ""}>Day / month / year</option><option value="ymd" ${mapping.dateFormat === "ymd" ? "selected" : ""}>Year / month / day</option></select></label>
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
  return `<nav class="review-tabs" aria-label="Review chapters">${tabs.map((item, index) => `<button data-tab="${item.id}" aria-current="${tab === item.id ? "step" : "false"}"><span>${String(index + 1).padStart(2, "0")}</span>${item.label}</button>`).join("")}</nav>`;
}

function summaryCards(transactions: Transaction[], month: string): string {
  const summary = monthSummary(transactions, month);
  return `<dl class="summary-strip"><div><dt>Money in</dt><dd>${amount(summary.income)}</dd></div><div><dt>Money out</dt><dd>${amount(summary.spending)}</dd></div><div class="${summary.net < 0 ? "negative" : "positive"}"><dt>Net</dt><dd>${summary.net >= 0 ? "+" : "−"}${amount(Math.abs(summary.net))}</dd></div></dl>`;
}

function overviewPanel(transactions: Transaction[], months: string[]): string {
  const current = months.at(-1) ?? "";
  const latest = transactions.filter((transaction) => transaction.date.startsWith(current));
  const reviewCount = data.reviews.length;
  return `<section class="panel" aria-labelledby="overview-title"><div class="panel-heading"><div><p class="eyebrow">Current chapter</p><h2 id="overview-title">${current ? html(monthName(current)) : "Review overview"}</h2><p>${latest.length} transactions across ${reviewCount} imported ${reviewCount === 1 ? "file" : "files"}. Amounts use your statement’s currency.</p></div><button class="button button-primary" data-action="start-import">${icon("plus")} Import another month</button></div>
    ${summaryCards(transactions, current)}
    <div class="privacy-callout">${icon("lock")} <div><strong>Nothing was uploaded.</strong><span>This summary was calculated in your browser and saved only on this device.</span></div></div>
    <div class="overview-grid"><section><h3>Next useful checks</h3><ol class="next-steps"><li><span>1</span><div><strong>Clean merchant names</strong><p>Turn statement codes into names you recognize.</p><button class="text-button" data-tab="tidy">Open tidy-up →</button></div></li><li><span>2</span><div><strong>Look at repeat charges</strong><p>${findRecurring(transactions).length} candidates found from the dates and amounts available.</p><button class="text-button" data-tab="recurring">Review candidates →</button></div></li><li><span>3</span><div><strong>Compare months</strong><p>${months.length > 1 ? "Two or more months are ready." : "Import one more month to reveal changes."}</p><button class="text-button" data-tab="compare">View comparison →</button></div></li></ol></section>
    <section class="recent-files"><h3>Files reviewed</h3><ul>${data.reviews.slice().reverse().map((review) => `<li><span class="file-pin">${icon("check")}</span><div><strong>${html(review.filename)}</strong><small>${review.transactions.length} rows · ${new Date(review.importedAt).toLocaleDateString()}${review.sourceCsv ? " · original kept locally" : ""}</small></div></li>`).join("")}</ul></section></div></section>`;
}

function tidyPanel(transactions: Transaction[]): string {
  const uncategorized = transactions.filter((transaction) => transaction.category === "Uncategorized").length;
  const rows = transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 80);
  return `<section class="panel" aria-labelledby="tidy-title"><div class="panel-heading"><div><p class="eyebrow">Chapter 02</p><h2 id="tidy-title">Make the statement recognizable</h2><p>Merge coded descriptions under one merchant name, assign a category, or split a mixed purchase. ${uncategorized} remain uncategorized.</p></div></div>
    <form id="rule-form" class="rule-form"><h3>Add a merchant rule</h3><label>When description contains<input name="match" required maxlength="80" autocomplete="off" placeholder="e.g. STREAMCO*4432" /></label><label>Show as<input name="merchant" required maxlength="80" autocomplete="off" placeholder="e.g. StreamCo" /></label><label>Category<input name="category" maxlength="40" autocomplete="off" placeholder="e.g. Subscriptions" /></label><button class="button button-secondary" type="submit">Save rule</button><p class="field-note">${unlocked ? "Plus active: save as many rules as you need." : `${data.rules.length}/5 free rules used. Plus removes the limit.`}</p><div id="rule-error" class="form-error" role="alert"></div></form>
    ${data.rules.length ? `<div class="saved-rules"><h3>Saved rules</h3><ul>${data.rules.map((rule) => `<li><span><b>Contains “${html(rule.match)}”</b> → ${html(rule.merchant)}${rule.category ? ` · ${html(rule.category)}` : ""}</span><button class="icon-button" data-remove-rule="${rule.id}" aria-label="Remove rule for ${html(rule.match)}">×</button></li>`).join("")}</ul></div>` : ""}
    <div class="transaction-list"><h3>Transactions</h3><p class="fine-print">Showing the newest ${rows.length}. Rules apply to all imported months.</p><div class="transaction-table">${rows.map((transaction) => `<article class="transaction-row" data-transaction="${transaction.id}"><div class="transaction-main"><time datetime="${transaction.date}">${html(dateName(transaction.date))}</time><div><strong>${html(transaction.merchant)}</strong><small title="Raw statement description">${html(transaction.description)}</small></div><span class="category-pill">${html(transaction.category)}</span><b class="transaction-amount ${transaction.amount < 0 ? "negative" : "positive"}">${transaction.amount < 0 ? "−" : "+"}${amount(Math.abs(transaction.amount))}</b></div><details><summary>Split or recategorize</summary><form class="transaction-edit-form" data-edit-transaction="${transaction.id}"><label>Category<input name="category" value="${html(transaction.category)}" maxlength="40" required /></label><div class="split-fields"><label>First part label<input name="label1" value="${html(transaction.splits[0]?.label ?? "")}" maxlength="40" /></label><label>Amount<input name="amount1" inputmode="decimal" value="${transaction.splits[0] ? amount(transaction.splits[0].amount) : ""}" /></label><label>Second part label<input name="label2" value="${html(transaction.splits[1]?.label ?? "")}" maxlength="40" /></label><label>Amount<input name="amount2" inputmode="decimal" value="${transaction.splits[1] ? amount(transaction.splits[1].amount) : ""}" /></label></div><p class="field-note">To split, both positive parts must add up to ${amount(Math.abs(transaction.amount))}.</p><div class="form-error" role="alert"></div><button class="button button-small button-secondary" type="submit">Save changes</button></form></details></article>`).join("")}</div></div></section>`;
}

function recurringPanel(transactions: Transaction[]): string {
  const candidates = findRecurring(transactions);
  return `<section class="panel" aria-labelledby="recurring-title"><div class="panel-heading"><div><p class="eyebrow">Chapter 03</p><h2 id="recurring-title">Charges that seem to return</h2><p>These are candidates based on similar merchant names, timing, and amounts—not confirmed subscriptions. Check each against the original statement.</p></div></div>
    ${candidates.length ? `<div class="candidate-grid">${candidates.map((candidate) => `<article class="candidate"><div class="candidate-top"><span class="confidence ${candidate.confidence}">${candidate.confidence === "likely" ? "Likely repeat" : "Worth checking"}</span><span>${html(candidate.cadence)}</span></div><h3>${html(candidate.merchant)}</h3><p class="candidate-amount">~${amount(candidate.typicalAmount)} <small>per charge</small></p><details><summary>See ${candidate.transactions.length} matching charges</summary><ul>${candidate.transactions.map((transaction) => `<li><time>${html(dateName(transaction.date))}</time><b>${amount(Math.abs(transaction.amount))}</b></li>`).join("")}</ul></details><button class="button button-secondary" data-add-check="recurring" data-label="Check ${html(candidate.merchant)}" data-detail="${html(candidate.cadence)}, about ${amount(candidate.typicalAmount)}">Add to checklist</button></article>`).join("")}</div>` : `<div class="empty-state"><span class="empty-moons">◐ ◑</span><h3>No repeat pattern yet</h3><p>We need at least two matching charges with a regular interval. Import another month, or tidy merchant names so matches line up.</p><button class="button button-primary" data-action="start-import">Import another month</button></div>`}
  </section>`;
}

function comparePanel(transactions: Transaction[], months: string[]): string {
  if (months.length < 2) return `<section class="panel" aria-labelledby="compare-title"><div class="panel-heading"><div><p class="eyebrow">Chapter 04</p><h2 id="compare-title">Compare one month with another</h2></div></div><div class="empty-state"><span class="empty-moons">◒</span><h3>One more month will reveal the change</h3><p>Import a CSV containing a different month. We’ll line up spending categories without building a budget.</p><button class="button button-primary" data-action="start-import">Import another month</button></div></section>`;
  const current = months.at(-1)!;
  const previous = months.at(-2)!;
  const changes = compareMonths(transactions, current, previous);
  const currentSummary = monthSummary(transactions, current);
  const previousSummary = monthSummary(transactions, previous);
  const max = Math.max(...changes.map((change) => Math.max(change.current, change.previous)), 1);
  return `<section class="panel" aria-labelledby="compare-title"><div class="panel-heading"><div><p class="eyebrow">Chapter 04</p><h2 id="compare-title">${html(monthName(current))} vs ${html(monthName(previous))}</h2><p>Largest category movements first. New categories are labelled instead of given a misleading percentage.</p></div></div>
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
  return `<section class="panel" aria-labelledby="finish-title"><div class="panel-heading"><div><p class="eyebrow">Chapter 05</p><h2 id="finish-title">Close the loop</h2><p>${done} of ${items.length} checklist items marked complete. The checklist and exports never need a network connection.</p></div></div>
    <div class="finish-grid"><section class="checklist"><h3>Your review checklist</h3>${items.length ? `<ul>${items.map((item) => `<li><label><input type="checkbox" data-check-item="${item.id}" ${item.done ? "checked" : ""} /><span><strong>${html(item.label)}</strong><small>${html(item.detail)}</small></span></label><button class="icon-button" data-remove-check="${item.id}" aria-label="Remove ${html(item.label)}">×</button></li>`).join("")}</ul>` : '<div class="mini-empty"><p>No items yet. Add candidates from Repeat charges or Compare, or write your own.</p></div>'}
      <form id="custom-check-form" class="custom-check"><label for="custom-check">Add your own check</label><div><input id="custom-check" name="label" maxlength="120" required placeholder="e.g. Ask about the duplicate café charge" /><button class="button button-secondary" type="submit">Add</button></div></form></section>
      <section class="review-note"><h3>Monthly note</h3><label for="review-notes">What did you notice?</label><textarea id="review-notes" rows="7" maxlength="2000" placeholder="A short note for next month…">${html(activeReview?.notes ?? "")}</textarea><p class="field-note">Saved only on this device.</p></section></div>
    <div class="export-block"><div><h3>Take your work with you</h3><p>Checklist is a readable Markdown file. Transaction CSV and private backup remain yours.</p></div><div class="export-actions"><button class="button button-primary" data-action="export-checklist">Export checklist</button><button class="button button-secondary" data-action="export-csv">Export transactions</button><button class="button button-quiet" data-action="export-backup">Export private backup</button><label class="button button-quiet" for="backup-file">Import backup</label><input class="visually-hidden" id="backup-file" type="file" accept="application/json,.json" /></div></div>
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
  return `<main id="main" class="workspace"><div class="workspace-title"><div><p class="eyebrow">Private monthly workspace</p><h1>Your statement review</h1></div><div class="local-badge">${icon("lock")} Local only</div></div>${reviewNav()}${panel}</main>`;
}

function plusDialog(): string {
  return `<dialog id="plus-dialog" class="dialog"><button class="dialog-close icon-button" data-action="close-plus" aria-label="Close Plus details">×</button><p class="eyebrow">Private Statement Review Plus</p><h2>Keep the useful extras, once.</h2><p class="dialog-price"><strong>US $19</strong> one-time · no subscription</p><ul class="feature-list"><li>${icon("check")} Keep an opt-in copy of the original CSV locally</li><li>${icon("check")} Save more than five merchant cleanup rules</li><li>${icon("check")} Use the license on your own devices</li></ul><p>The complete review, comparisons, accessibility, checklist, and every export stay free.</p>${unlocked ? '<div class="license-active">✓ Plus is active on this device.</div>' : `<a class="button button-primary button-wide" href="${checkoutUrl()}">Buy Plus securely ${icon("arrow")}</a>`}<hr><form id="license-form"><label for="license-token">Have a license? Paste it here</label><div class="license-input"><input id="license-token" name="license" required autocomplete="off" spellcheck="false" /><button class="button button-secondary" type="submit">Verify</button></div><div id="license-status" class="form-error" role="status"></div></form><p class="fine-print">Checkout and refunds are handled by Sociobot/Dodo, the merchant of record. <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a></p></dialog>`;
}

function dialogs(): string {
  return `${plusDialog()}<dialog id="clear-dialog" class="dialog"><p class="eyebrow">This cannot be undone</p><h2>Clear every local review?</h2><p>This removes ${data.reviews.length} imported ${data.reviews.length === 1 ? "file" : "files"}, all transaction rows, merchant rules, notes, and retained CSV text from this browser. Your original files elsewhere are not affected.</p><div class="form-actions"><button class="button button-quiet" data-action="cancel-clear">Keep my data</button><button class="button button-danger" data-action="clear-all">Clear everything</button></div></dialog>`;
}

function noticeRegion(): string {
  return `<div id="live-notice" class="toast" role="status" aria-live="polite">${html(notice)}</div><div id="network-status" class="network-status" role="status" aria-live="polite" hidden></div><div id="update-toast" class="update-toast" hidden><span>An app update is ready.</span><button class="button button-small button-secondary" data-action="update-app">Update now</button></div>`;
}

function render(): void {
  const path = location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/privacy") root.innerHTML = legalPage("privacy");
  else if (path === "/terms") root.innerHTML = legalPage("terms");
  else if (loading) root.innerHTML = `<main id="main" class="loading-screen"><div class="loading-moon" aria-hidden="true"></div><h1>Opening your private workspace…</h1><p>Reading only this device.</p></main>${noticeRegion()}`;
  else root.innerHTML = `${header()}${view === "import" ? importView() : data.reviews.length && view === "review" ? workspace() : hero()}${footer()}${dialogs()}${noticeRegion()}`;
  updateNetworkStatus();
}

function mappingFromForm(form: HTMLFormElement): ColumnMapping {
  const formData = new FormData(form);
  return {
    date: String(formData.get("date") ?? ""), description: String(formData.get("description") ?? ""), amount: String(formData.get("amount") ?? ""),
    debit: String(formData.get("debit") ?? ""), credit: String(formData.get("credit") ?? ""), category: String(formData.get("category") ?? ""),
    dateFormat: String(formData.get("dateFormat") ?? "auto") as ColumnMapping["dateFormat"]
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
    const parsed = JSON.parse(await file.text()) as AppData;
    if (parsed.version !== 1 || !Array.isArray(parsed.reviews) || !Array.isArray(parsed.rules)) throw new Error("This is not a valid Private Statement Review backup.");
    data = parsed;
    await saveData(data);
    view = data.reviews.length ? "review" : "home";
    render();
    announce("Private backup imported");
  } catch (error) { announce(error instanceof Error ? error.message : "The backup could not be imported."); }
}

function useSample(): void {
  const sample = `Date,Description,Amount,Category\n2026-06-03,ACME PAYROLL,3200.00,Income\n2026-06-05,STREAMCO*1029,-14.99,Subscriptions\n2026-06-09,CORNER MARKET,-84.40,Groceries\n2026-06-18,CITY ENERGY,-91.20,Utilities\n2026-07-03,ACME PAYROLL,3200.00,Income\n2026-07-05,STREAMCO*4821,-14.99,Subscriptions\n2026-07-09,CORNER MARKET,-112.70,Groceries\n2026-07-18,CITY ENERGY,-128.60,Utilities\n2026-07-22,CAFE AND BOOKS,-46.50,Uncategorized`;
  const table = parseCsv(sample);
  draft = { ...table, filename: "safe-sample.csv", raw: sample, mapping: guessMapping(table.headers, data.mapping), errors: [] };
  view = "import";
  render();
}

function updateNetworkStatus(): void {
  const status = document.querySelector<HTMLElement>("#network-status");
  if (!status) return;
  status.hidden = navigator.onLine;
  status.innerHTML = navigator.onLine ? "" : `${icon("moon")} Offline — your saved reviews still work`;
}

root.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  const button = target.closest<HTMLElement>("[data-action], [data-tab], [data-remove-rule], [data-add-check], [data-remove-check]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "start-import") { view = "import"; draft = null; render(); window.scrollTo(0, 0); }
  if (action === "cancel-import" || action === "dashboard") { view = data.reviews.length ? "review" : "home"; draft = null; render(); }
  if (action === "discard-draft") { draft = null; render(); }
  if (action === "use-sample") useSample();
  if (action === "theme") {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("psr-theme", next);
  }
  if (action === "plus") (document.querySelector("#plus-dialog") as HTMLDialogElement)?.showModal();
  if (action === "close-plus") (document.querySelector("#plus-dialog") as HTMLDialogElement)?.close();
  if (action === "confirm-clear") (document.querySelector("#clear-dialog") as HTMLDialogElement)?.showModal();
  if (action === "cancel-clear") (document.querySelector("#clear-dialog") as HTMLDialogElement)?.close();
  if (action === "clear-all") void clearData().then(() => { data = emptyData(); view = "home"; draft = null; render(); announce("All review data was cleared from this browser"); });
  if (action === "export-checklist") exportChecklist();
  if (action === "export-csv") exportCsv();
  if (action === "export-backup") { download(`private-statement-review-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), "application/json"); announce("Private backup exported"); }
  if (action === "update-app") navigator.serviceWorker?.getRegistration().then((registration) => registration?.waiting?.postMessage({ type: "SKIP_WAITING" }));
  if (button.dataset.tab) { tab = button.dataset.tab as Tab; render(); document.querySelector(".panel")?.scrollIntoView({ block: "start" }); }
  if (button.dataset.removeRule) {
    const removed = data.rules.find((rule) => rule.id === button.dataset.removeRule);
    data.rules = data.rules.filter((rule) => rule.id !== button.dataset.removeRule);
    queueSave("Merchant rule removed"); render();
    if (removed) announce(`Removed rule for ${removed.match}`);
  }
  if (button.dataset.addCheck) {
    addChecklistItem({ kind: button.dataset.addCheck as ChecklistItem["kind"], label: button.dataset.label ?? "Review item", detail: button.dataset.detail ?? "" });
    button.textContent = "Added ✓";
  }
  if (button.dataset.removeCheck) {
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
      void saveData(data).then(() => {
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
    saveLicense(token);
    if (status) status.textContent = "Checking license…";
    void verifyLicense(true).then((result) => {
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
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload());
  }).catch(() => { /* app remains usable without installation */ });
}

document.documentElement.dataset.theme = localStorage.getItem("psr-theme") ?? "auto";
captureReturnedLicense();
unlocked = cachedUnlock();
render();
void loadData().then((stored) => {
  data = stored;
  loading = false;
  view = data.reviews.length ? "review" : "home";
  render();
  registerServiceWorker();
  if (unlocked && navigator.onLine) void verifyLicense().then((result) => {
    if (!result.valid) { unlocked = false; render(); announce("Your Plus license is no longer active. The free review remains available."); }
  }).catch(() => { /* cached access remains available offline */ });
}).catch((error: Error) => { loading = false; render(); announce(error.message); });
