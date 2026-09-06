export const PRODUCT_SLUG = "private-statement-review";
export const BILLING_BASE = import.meta.env.VITE_BILLING_BASE_URL ?? "https://api.sociobot.in/api/v1";
const LICENSE_KEY = `sb_license:${PRODUCT_SLUG}`;
const VERDICT_KEY = `sb_license_verdict:${PRODUCT_SLUG}`;
const DAY = 86_400_000;

type Verdict = { valid: boolean; checkedAt: number; reason?: string };

const keyFor = (key: string, demo = false): string => demo ? `demo:${key}` : key;

export function captureReturnedLicense(demo = false): string | null {
  const url = new URL(location.href);
  const token = url.searchParams.get("license")?.trim();
  const licenseKey = keyFor(LICENSE_KEY, demo);
  const verdictKey = keyFor(VERDICT_KEY, demo);
  if (!token) return localStorage.getItem(licenseKey);
  localStorage.setItem(licenseKey, token);
  localStorage.setItem(verdictKey, JSON.stringify({ valid: true, checkedAt: 0 } satisfies Verdict));
  url.searchParams.delete("license");
  history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  return token;
}

export function savedLicense(demo = false): string | null {
  return localStorage.getItem(keyFor(LICENSE_KEY, demo));
}

export function saveLicense(token: string, demo = false): void {
  localStorage.setItem(keyFor(LICENSE_KEY, demo), token.trim());
  localStorage.removeItem(keyFor(VERDICT_KEY, demo));
}

export function cachedUnlock(demo = false): boolean {
  if (!savedLicense(demo)) return false;
  try {
    return (JSON.parse(localStorage.getItem(keyFor(VERDICT_KEY, demo)) ?? "null") as Verdict | null)?.valid ?? true;
  } catch {
    return true;
  }
}

export async function verifyLicense(force = false, demo = false): Promise<{ valid: boolean; reason: string }> {
  const licenseKey = keyFor(LICENSE_KEY, demo);
  const verdictKey = keyFor(VERDICT_KEY, demo);
  const token = localStorage.getItem(licenseKey);
  if (!token) return { valid: false, reason: "missing" };
  try {
    const cached = JSON.parse(localStorage.getItem(verdictKey) ?? "null") as Verdict | null;
    if (!force && cached && Date.now() - cached.checkedAt < DAY) return { valid: cached.valid, reason: cached.reason ?? "cached" };
  } catch { /* verify afresh */ }
  const response = await fetch(`${BILLING_BASE}/products/${PRODUCT_SLUG}/verify?license=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error("License service unavailable");
  const result = await response.json() as { valid: boolean; reason: string };
  localStorage.setItem(verdictKey, JSON.stringify({ valid: result.valid, reason: result.reason, checkedAt: Date.now() } satisfies Verdict));
  return result;
}
