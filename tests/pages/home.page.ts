import type { Page } from "@playwright/test";
import { forbiddenControl, targetUrl } from "../support/target";

export type ButtonStep = { label: string; actual: string; activated: boolean };

export class HomePage {
  readonly target = targetUrl();

  constructor(private readonly page: Page) {}

  async open(): Promise<number> {
    const response = await this.page.goto(this.target, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await this.page.waitForLoadState("load", { timeout: 8_000 }).catch(() => undefined);
    return response?.status() ?? 0;
  }

  async visibleHeadings(): Promise<string[]> {
    return this.page.evaluate(() => {
      const clean = (value: string | null) => (value || "").replace(/\s+/g, " ").trim();
      return [...document.querySelectorAll("h1")]
        .filter((el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && clean(el.textContent).length > 0;
        })
        .map((el) => clean(el.textContent));
    });
  }

  title(): Promise<string> {
    return this.page.title();
  }

  async metaDescription(): Promise<string> {
    return this.page.locator('meta[name="description"]').first().getAttribute("content").then((value) => (value || "").trim());
  }

  async zoomDisabled(): Promise<boolean> {
    const content = (await this.page.locator('meta[name="viewport"]').first().getAttribute("content")) || "";
    const value = content.toLowerCase().replace(/\s/g, "");
    if (!value) return false;
    if (/user-scalable=(no|0)/.test(value)) return true;
    const max = value.match(/maximum-scale=([0-9.]+)/);
    return Boolean(max && Number(max[1]) <= 1);
  }

  async contrast(): Promise<{ ratio: number | null; sample: string }> {
    return this.page.evaluate(() => {
      const clean = (value: string | null) => (value || "").replace(/\s+/g, " ").trim();
      const visible = (el: Element) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const parse = (value: string) => {
        const match = value.match(/rgba?\(([^)]+)\)/);
        if (!match?.[1]) return null;
        const parts = match[1].split(",").map((part) => Number(part.trim()));
        if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
        return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts[3] ?? 1 };
      };
      const channel = (value: number) => {
        const scaled = value / 255;
        return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
      };
      const luminance = (color: { r: number; g: number; b: number }) => 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
      const sample = [...document.querySelectorAll("h1, p")].find((el) => visible(el) && clean(el.textContent).length > 12);
      if (!sample) return { ratio: null, sample: "" };
      const foreground = parse(getComputedStyle(sample).color);
      let node: Element | null = sample;
      let background: { r: number; g: number; b: number; a: number } | null = null;
      while (node) {
        const color = parse(getComputedStyle(node).backgroundColor);
        if (color && color.a > 0.2) {
          background = color;
          break;
        }
        node = node.parentElement;
      }
      if (!foreground || !background) return { ratio: null, sample: clean(sample.textContent).slice(0, 60) };
      const lighter = Math.max(luminance(foreground), luminance(background));
      const darker = Math.min(luminance(foreground), luminance(background));
      return { ratio: (lighter + 0.05) / (darker + 0.05), sample: clean(sample.textContent).slice(0, 60) };
    });
  }

  async firstViewImages(): Promise<{ checked: number; missingAlt: number }> {
    return this.page.evaluate(() => {
      const images = [...document.querySelectorAll("img")].filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0 && rect.height > 0;
      });
      const missingAlt = images.filter((img) => {
        const role = (img.getAttribute("role") || "").toLowerCase();
        if (role === "presentation" || role === "none" || img.getAttribute("aria-hidden") === "true") return false;
        return img.getAttribute("alt") === null;
      }).length;
      return { checked: images.length, missingAlt };
    });
  }

  async overflowAt(width: number): Promise<number> {
    await this.page.setViewportSize({ width, height: 844 });
    await this.page.waitForTimeout(300);
    return this.page.evaluate(() => {
      const visible = (el: Element) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      return [...document.querySelectorAll("main h1, main h2, main p, h1, h2")].filter((el) => visible(el) && el.scrollWidth > el.clientWidth + 2).length;
    });
  }

  async visibleButtons(): Promise<string[]> {
    return this.page.evaluate(() => {
      const clean = (value: string | null) => (value || "").replace(/\s+/g, " ").trim();
      const seen = new Set<string>();
      const labels: string[] = [];
      for (const el of document.querySelectorAll("button, [role='button']")) {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) continue;
        if (/datepicker__day/i.test(String(el.className))) continue;
        const label = (clean(el.getAttribute("aria-label") || el.textContent) || "Button").slice(0, 80);
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        labels.push(label);
      }
      return labels;
    });
  }

  async exerciseButtons(): Promise<ButtonStep[]> {
    const labels = await this.visibleButtons();
    const steps: ButtonStep[] = [];
    for (const label of labels) {
      if (forbiddenControl(label)) {
        steps.push({ label, actual: "Visible. Not activated.", activated: false });
        continue;
      }
      if (/\bbook(?:\s+now)?\b/i.test(label) && !/most booked/i.test(label)) {
        steps.push({ label, actual: "Visible. Left for the booking walk.", activated: false });
        continue;
      }
      const clicked = await this.page.evaluate((expected) => {
        const clean = (value: string | null) => (value || "").replace(/\s+/g, " ").trim();
        const target = [...document.querySelectorAll("button, [role='button']")].find((el) => {
          const style = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return style.display !== "none" && rect.width > 0 && rect.height > 0 && clean(el.getAttribute("aria-label") || el.textContent) === expected;
        }) as HTMLElement | undefined;
        if (!target || (target.getAttribute("type") || "").toLowerCase() === "submit") return false;
        target.scrollIntoView({ block: "center" });
        target.click();
        return true;
      }, label);
      await this.page.waitForTimeout(250);
      if (/sign[\s-]*in|log[\s-]*in|register/i.test(label)) {
        await this.page.keyboard.press("Escape").catch(() => undefined);
        steps.push({ label, actual: "Opened. Nothing was typed or submitted.", activated: clicked });
      } else {
        steps.push({ label, actual: clicked ? "Activated. No form was submitted." : "Not visible when the check ran.", activated: clicked });
      }
      if (this.page.url() !== this.target) {
        await this.page.goto(this.target, { waitUntil: "domcontentloaded", timeout: 20_000 }).catch(() => undefined);
      }
    }
    return steps;
  }

  async phoneMenu(): Promise<{ found: boolean; opened: boolean; closed: boolean; label: string }> {
    await this.page.setViewportSize({ width: 390, height: 844 });
    const found = await this.page.evaluate(() => {
      const clean = (value: string | null) => (value || "").replace(/\s+/g, " ").trim();
      const visible = (el: Element) => {
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const buttons = [...document.querySelectorAll("button, [role='button'], [aria-expanded], [aria-controls]")].filter(
        (el) => visible(el) && (el.getAttribute("type") || "").toLowerCase() !== "submit",
      );
      const labelOf = (el: Element) => clean(el.getAttribute("aria-label") || el.textContent);
      const named = (el: Element) => /menu|navigat/i.test(labelOf(el));
      const pick =
        buttons.find((el) => named(el) && (el.hasAttribute("aria-expanded") || el.hasAttribute("aria-controls"))) ||
        buttons.find((el) => named(el));
      if (!pick) return null;
      pick.setAttribute("data-pom-menu", "1");
      return labelOf(pick).slice(0, 60);
    });
    if (!found) return { found: false, opened: false, closed: false, label: "" };
    const press = () =>
      this.page.evaluate(() => {
        const el = document.querySelector("[data-pom-menu='1']") as HTMLElement | null;
        el?.scrollIntoView({ block: "center" });
        el?.click();
      });
    const panelOpen = () =>
      this.page.evaluate(() => {
        const el = document.querySelector("[data-pom-menu='1']");
        const panelId = el?.getAttribute("aria-controls");
        const panel = panelId ? document.getElementById(panelId) : null;
        const style = panel ? getComputedStyle(panel) : null;
        const shown = Boolean(style && style.display !== "none" && panel && panel.getBoundingClientRect().height > 0);
        return el?.getAttribute("aria-expanded") === "true" || shown;
      });
    await press();
    await this.page.waitForTimeout(450);
    const opened = await panelOpen();
    await press();
    await this.page.waitForTimeout(450);
    const stillOpen = await panelOpen();
    return { found: true, opened, closed: opened && !stillOpen, label: found };
  }
}
