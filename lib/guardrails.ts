import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export class GuardrailError extends Error {
  readonly status = "BLOCKED" as const;
  readonly role = "guardrail";

  constructor(message: string) {
    super(message);
    this.name = "GuardrailError";
  }
}

export class CrawlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrawlError";
  }
}

const FORBIDDEN_PATH =
  /(?:^|\/)(checkout|cart|payment|payments|pay|billing|credit-?card|login|log-in|signin|sign-in|wp-admin|wp-login|delete-account|account\/delete)(?:\/|$)/i;

const FORBIDDEN_QUERY = /(?:^|&)(cardnumber|card_number|cvv|cvc|password|passwd)=/i;

export function isForbiddenUrl(url: URL): boolean {
  const path = decodeURIComponent(url.pathname);
  if (FORBIDDEN_PATH.test(path)) return true;
  if (FORBIDDEN_QUERY.test(url.search.slice(1))) return true;
  return false;
}

export function allowedHostsFor(hostname: string): Set<string> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const set = new Set<string>([host]);
  if (host.startsWith("www.")) set.add(host.slice(4));
  else if (host.includes(".")) set.add(`www.${host}`);
  return set;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  let normalized = ip.toLowerCase().split("%")[0] ?? ip;
  if (normalized.startsWith("::ffff:")) {
    normalized = normalized.slice(7);
  }
  const v4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((n) => n > 255)) return true;
    const a = parts[0] ?? 0;
    const b = parts[1] ?? 0;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    return false;
  }
  if (normalized === "::1" || normalized === "::") return true;
  if (/^f[cd]/.test(normalized)) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  return false;
}

function blockedHostname(host: string): string | null {
  const name = host.toLowerCase().replace(/\.$/, "");
  if (
    name === "localhost" ||
    name.endsWith(".localhost") ||
    name.endsWith(".local") ||
    name.endsWith(".internal") ||
    name === "metadata.google.internal" ||
    name === "metadata.google.com"
  ) {
    return "Refusing a local, internal, or metadata host.";
  }
  if (!name.includes(".") && !isIP(name)) {
    return "Refusing a single-label host. Paste a public website URL.";
  }
  if (/^\d+(\.\d+){1,3}$/.test(name) && !isIP(name)) {
    return "Refusing a numeric host that is not a normal public IP address.";
  }
  if (isIP(name) && isPrivateOrReservedIp(name)) {
    return "Refusing a private, loopback, or reserved address.";
  }
  return null;
}

export function parsePublicUrl(raw: string): URL {
  const text = raw.trim();
  if (!text || text.length > 2000) {
    throw new GuardrailError("Paste a public http or https URL, up to 2000 characters.");
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new GuardrailError("That text is not a URL. Include https:// and a host.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new GuardrailError("Only http and https URLs can be audited.");
  }
  if (url.username || url.password) {
    throw new GuardrailError("Refusing a URL that contains a username or password.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new GuardrailError("Only ports 80 and 443 are allowed in this demo.");
  }
  const hostBlock = blockedHostname(url.hostname);
  if (hostBlock) throw new GuardrailError(hostBlock);
  if (isForbiddenUrl(url)) {
    throw new GuardrailError(
      "Refusing a checkout, payment, login, or account-delete URL. This auditor does not open those flows.",
    );
  }
  return url;
}

export async function assertPublicDns(hostname: string): Promise<void> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const blocked = blockedHostname(host);
  if (blocked) throw new GuardrailError(blocked);
  if (isIP(host)) return;

  let records: { address: string }[];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new CrawlError(`Could not resolve ${host}.`);
  }
  if (records.length === 0) {
    throw new CrawlError(`Could not resolve ${host}.`);
  }
  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new GuardrailError(
        `Refusing ${host} because it resolves to a private or reserved address (${record.address}).`,
      );
    }
  }
}
