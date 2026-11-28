export function targetUrl(): string {
  const raw = process.env.TARGET_URL || "https://www.seadwellers.com/";
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("TARGET_URL must be an http or https address.");
  }
  return url.toString();
}

export function sameHost(left: string, right: string): boolean {
  const a = new URL(left).hostname.toLowerCase().replace(/^www\./, "");
  const b = new URL(right).hostname.toLowerCase().replace(/^www\./, "");
  return a === b;
}

const FORBIDDEN_PATH =
  /(?:^|\/)(checkout|cart|payment|payments|pay|billing|credit-?card|login|log-in|signin|sign-in|wp-admin|wp-login|delete-account|account\/delete)(?:\/|$)/i;

export function forbiddenAddress(raw: string): boolean {
  try {
    const url = new URL(raw);
    return FORBIDDEN_PATH.test(decodeURIComponent(url.pathname));
  } catch {
    return true;
  }
}

export function forbiddenControl(label: string): boolean {
  return /pay\b|place order|submit payment|complete purchase|buy now|credit card|delete account|\bdelete\b/i.test(label);
}
