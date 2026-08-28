export const PRODUCT_SLUG = "private-statement-review";
export const BILLING_BASE = "https://api.sociobot.in/api/v1";
const LICENSE_KEY = `sb_license:${PRODUCT_SLUG}`;
const VERDICT_KEY = `sb_license_verdict:${PRODUCT_SLUG}`;
const DAY = 86_400_000;

type Verdict = { valid: boolean; checkedAt: number; reason?: string };

export function checkoutUrl(): string {
  return `${BILLING_BASE}/products/${PRODUCT_SLUG}/checkout`;
}

export function captureReturnedLicense(): string | null {
  const url = new URL(location.href);
  const token = url.searchParams.get("license")?.trim();
  if (!token) return localStorage.getItem(LICENSE_KEY);
  localStorage.setItem(LICENSE_KEY, token);
  localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: true, checkedAt: 0 } satisfies Verdict));
  url.searchParams.delete("license");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  return token;
}

export function savedLicense(): string | null {
  return localStorage.getItem(LICENSE_KEY);
}

export function saveLicense(token: string): void {
  localStorage.setItem(LICENSE_KEY, token.trim());
  localStorage.removeItem(VERDICT_KEY);
}

export function cachedUnlock(): boolean {
  if (!savedLicense()) return false;
  try {
    return (JSON.parse(localStorage.getItem(VERDICT_KEY) ?? "null") as Verdict | null)?.valid ?? true;
  } catch {
    return true;
  }
}

export async function verifyLicense(force = false): Promise<{ valid: boolean; reason: string }> {
  const token = savedLicense();
  if (!token) return { valid: false, reason: "missing" };
  try {
    const cached = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? "null") as Verdict | null;
    if (!force && cached && Date.now() - cached.checkedAt < DAY) return { valid: cached.valid, reason: cached.reason ?? "cached" };
  } catch { /* verify afresh */ }
  const response = await fetch(`${BILLING_BASE}/products/${PRODUCT_SLUG}/verify?license=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error("License service unavailable");
  const result = await response.json() as { valid: boolean; reason: string };
  localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: result.valid, reason: result.reason, checkedAt: Date.now() } satisfies Verdict));
  return result;
}
