import type { Page } from "@playwright/test";
import { forbiddenControl, targetUrl } from "../support/target";

export type BookingStop = { url: string; filledFields: number; steps: string[] };

export class BookingPage {
  readonly target = targetUrl();

  constructor(private readonly page: Page) {}

  async walkUntilCheckout(): Promise<BookingStop> {
    await this.page.goto(this.target, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await this.page.setViewportSize({ width: 1280, height: 900 });
    const steps: string[] = [];
    const book = await this.click("book");
    if (!book) return { url: this.page.url(), filledFields: await this.sensitiveFilled(), steps: ["No booking control was visible."] };
    await this.page.waitForTimeout(800);
    await this.page
      .waitForFunction(
        () => [...document.querySelectorAll("[aria-label]")].some((el) => /^Choose\b/i.test(el.getAttribute("aria-label") || "") && /\d/.test(el.getAttribute("aria-label") || "")),
        { timeout: 8_000 },
      )
      .catch(() => undefined);
    steps.push(book);
    const done = new Set<string>();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (await this.onCheckout()) break;
      let acted = false;
      for (const kind of ["time", "checkout", "date"] as const) {
        const label = await this.click(kind);
        if (!label || done.has(`${kind}:${label}`)) continue;
        if (forbiddenControl(label)) continue;
        done.add(`${kind}:${label}`);
        await this.page.waitForTimeout(1200);
        steps.push(label);
        acted = true;
        break;
      }
      if (!acted || (await this.onCheckout())) break;
    }
    return { url: this.page.url(), filledFields: await this.sensitiveFilled(), steps };
  }

  private async onCheckout(): Promise<boolean> {
    if (/\/checkout(?:\/|$|\?)/i.test(this.page.url())) return true;
    return this.page.evaluate(() => /checkout/i.test(`${document.title} ${[...document.querySelectorAll("h1")].map((el) => el.textContent || "").join(" ")}`));
  }

  private async sensitiveFilled(): Promise<number> {
    return this.page.evaluate(() =>
      [...document.querySelectorAll("input, textarea")].filter((el) => {
        const field = el as HTMLInputElement;
        const hint = `${field.name} ${field.placeholder} ${field.getAttribute("aria-label") || ""} ${field.id}`.toLowerCase();
        const sensitive = /card|cvv|cvc|name|email|phone|guest/.test(hint);
        return sensitive && field.value.trim().length > 0;
      }).length,
    );
  }

  private click(kind: "book" | "date" | "time" | "checkout"): Promise<string | null> {
    return this.page.evaluate((action) => {
      const clean = (value: string | null) => (value || "").replace(/\s+/g, " ").trim();
      const visible = (el: Element) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
      };
      const labelOf = (el: Element) => clean(el.getAttribute("aria-label") || el.textContent);
      const dangerous = (label: string) => /pay\b|place order|submit payment|credit card|\bdelete\b/i.test(label);
      const dialog = [...document.querySelectorAll("[role='dialog'], [aria-modal='true'], [class*='popup']")].find((el) => {
        if (!visible(el) || el.getBoundingClientRect().height < 180) return false;
        if (/datepicker/i.test(String(el.className))) return false;
        return /checkout|start time|guest/i.test(el.textContent || "");
      });
      let target: Element | null = null;
      if (action === "checkout") {
        const root = dialog || document;
        target = [...root.querySelectorAll("button, [role='button'], a")].find((el) => visible(el) && /continue to checkout|proceed to checkout/i.test(labelOf(el)) && !(el as HTMLButtonElement).disabled) || null;
      } else if (action === "time") {
        if (!dialog) return null;
        const times = [...dialog.querySelectorAll("label, button, [role='button'], p, div")].filter((el) => {
          const text = labelOf(el);
          return visible(el) && text.length < 80 && el.children.length < 5 && /\d{1,2}:\d{2}\s*(am|pm)/i.test(text);
        });
        times.sort((a, b) => labelOf(a).length - labelOf(b).length);
        target = times[0] || null;
      } else if (action === "date") {
        if (dialog) return null;
        const isDay = (el: Element) => {
          const label = el.getAttribute("aria-label") || "";
          return /^Choose\b/i.test(label) && /\d/.test(label) && !/disabled/i.test(String(el.className)) && el.getAttribute("data-pom-used") !== "1";
        };
        for (const heading of document.querySelectorAll("h2, h3")) {
          let node: Element | null = heading.parentElement;
          for (let depth = 0; depth < 10 && node; depth += 1) {
            const headings = node.querySelectorAll("h2, h3").length;
            const day = [...node.querySelectorAll("[aria-label]")].find(isDay);
            if (day && headings >= 1 && headings <= 3 && (node.textContent || "").length < 8000) {
              target = day;
              break;
            }
            if (headings > 6) break;
            node = node.parentElement;
          }
          if (target) break;
        }
      } else {
        target = [...document.querySelectorAll("button, [role='button'], a")].find((el) => {
          const label = labelOf(el);
          return visible(el) && /\bbook(?:\s+now)?\b/i.test(label) && !/sign[\s-]*in|register|most booked/i.test(label) && !dangerous(label);
        }) || null;
      }
      if (!target || dangerous(labelOf(target))) return null;
      const label = (target.getAttribute("aria-label") || labelOf(target)).slice(0, 80);
      target.setAttribute("data-pom-used", "1");
      (target as HTMLElement).scrollIntoView({ block: "center" });
      (target as HTMLElement).click();
      return label || action;
    }, kind);
  }
}
