import { existsSync } from "fs";
import { defineConfig } from "@playwright/test";

const systemChrome =
  process.env.PLAYWRIGHT_CHROME_PATH ||
  ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) =>
    existsSync(p),
  );

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    headless: true,
    launchOptions: systemChrome
      ? {
          executablePath: systemChrome,
          args: ["--no-sandbox", "--disable-gpu"],
        }
      : undefined,
  },
});
