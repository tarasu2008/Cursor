export function parseRobots(body: string): { disallow: string[]; sitemaps: string[] } {
  const lines = body.split(/\r?\n/);
  let applies = false;
  const disallow: string[] = [];
  const sitemaps: string[] = [];

  for (const line of lines) {
    const trimmed = line.split("#")[0]?.trim() ?? "";
    if (!trimmed) continue;
    const splitAt = trimmed.indexOf(":");
    if (splitAt < 0) continue;
    const key = trimmed.slice(0, splitAt).trim().toLowerCase();
    const value = trimmed.slice(splitAt + 1).trim();
    if (key === "user-agent") {
      applies = value === "*";
      continue;
    }
    if (key === "sitemap" && value) {
      sitemaps.push(value);
      continue;
    }
    if (applies && key === "disallow" && value) {
      disallow.push(value);
    }
  }

  return { disallow, sitemaps };
}

export function isDisallowed(pathname: string, rules: string[]): boolean {
  for (const rule of rules) {
    if (rule === "/") return true;
    const prefix = rule.split("*")[0] ?? rule;
    if (!prefix) continue;
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}
