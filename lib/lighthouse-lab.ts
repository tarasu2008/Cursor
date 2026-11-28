import { spawn } from "child_process";
import { mkdtemp, readdir, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";

export type LabScores = {
  performance: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  seo: number | null;
};

const CHROME = process.env.CHROME_PATH || "/usr/local/bin/google-chrome";

export async function runLighthouseLab(url: string, formFactor: "mobile" | "desktop"): Promise<LabScores> {
  const dir = await mkdtemp(path.join(tmpdir(), "lighthouse-"));
  const output = path.join(dir, "report.json");
  const bin = path.join(process.cwd(), "node_modules/lighthouse/cli/index.js");
  const args = [
    bin,
    url,
    "--output=json",
    `--output-path=${output}`,
    "--quiet",
    "--no-enable-error-reporting",
    "--disable-full-page-screenshot",
    "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
    "--only-categories=performance,accessibility,best-practices,seo",
    formFactor === "desktop" ? "--preset=desktop" : "--form-factor=mobile",
  ];
  try {
    await run(args);
    const report = JSON.parse(await readReport(dir, output)) as {
      categories?: Record<string, { score?: number | null }>;
    };
    return {
      performance: scoreOf(report, "performance"),
      accessibility: scoreOf(report, "accessibility"),
      bestPractices: scoreOf(report, "best-practices"),
      seo: scoreOf(report, "seo"),
    };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function readReport(dir: string, output: string): Promise<string> {
  try {
    return await readFile(output, "utf8");
  } catch {
    const names = await readdir(dir);
    const json = names.find((name) => name.endsWith(".json"));
    if (!json) throw new Error("Lighthouse did not write a report.");
    return readFile(path.join(dir, json), "utf8");
  }
}

function scoreOf(report: { categories?: Record<string, { score?: number | null }> }, id: string): number | null {
  const value = report.categories?.[id]?.score;
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

function run(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, CHROME_PATH: CHROME },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let errorText = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Lighthouse lab timed out."));
    }, 180_000);
    child.stderr.on("data", (chunk: Buffer) => {
      errorText += chunk.toString();
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(errorText.trim().slice(0, 400) || `Lighthouse exited ${code}.`));
    });
  });
}
