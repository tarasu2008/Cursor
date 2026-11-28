import type { Page } from "@playwright/test";
import { forbiddenAddress, sameHost, targetUrl } from "../support/target";

export type FoundLink = { label: string; url: string };

export class NavPage {
  readonly target = targetUrl();

  constructor(private readonly page: Page) {}

  async linksIn(selector: string): Promise<FoundLink[]> {
    const raw = await this.page.evaluate((root) => {
      const clean = (value: string | null) => (value || "").replace(/\s+/g, " ").trim();
      return [...document.querySelectorAll(root)].map((el) => ({
        label: (clean(el.getAttribute("aria-label") || el.textContent) || "Link").slice(0, 80),
        url: (el as HTMLAnchorElement).href,
      }));
    }, selector);
    return this.keep(raw);
  }

  async menuLinks(): Promise<FoundLink[]> {
    const before = new Set((await this.linksIn("header a, nav a, [role='navigation'] a")).map((link) => link.url));
    await this.page.evaluate(() => {
      const visible = (el: Element) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      const triggers = [...document.querySelectorAll("header button, nav button, header [aria-expanded], nav [aria-haspopup]")].filter((el) => {
        if (!visible(el)) return false;
        const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim();
        return el.hasAttribute("aria-expanded") || el.hasAttribute("aria-haspopup") || /menu|more|nav/i.test(label);
      });
      for (const trigger of triggers.slice(0, 6)) (trigger as HTMLElement).click();
    });
    await this.page.waitForTimeout(300);
    const revealed = (await this.linksIn("header a, nav a, [role='navigation'] a, [role='menu'] a")).filter((link) => !before.has(link.url));
    return revealed;
  }

  async statusOf(url: string): Promise<number> {
    const response = await this.page.request.get(url, { timeout: 15_000, failOnStatusCode: false });
    return response.status();
  }

  async unknownPath(): Promise<{ status: number; url: string }> {
    const url = new URL("/qa-first-pass-missing", this.target).toString();
    const response = await this.page.request.get(url, { timeout: 15_000, failOnStatusCode: false });
    return { status: response.status(), url: response.url() };
  }

  private keep(links: FoundLink[]): FoundLink[] {
    const seen = new Set<string>();
    const found: FoundLink[] = [];
    for (const link of links) {
      let url: URL;
      try {
        url = new URL(link.url);
      } catch {
        continue;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") continue;
      if (!sameHost(url.toString(), this.target)) continue;
      if (forbiddenAddress(url.toString())) continue;
      if (/\.(?:png|jpe?g|gif|webp|svg|css|js|pdf)$/i.test(url.pathname)) continue;
      url.hash = "";
      const key = url.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ label: link.label, url: key });
    }
    return found;
  }
}
