import { z } from "zod";

export const findingSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
  state: z.enum(["pass", "fail", "info"]),
});

export const categorySchema = z.object({
  id: z.enum(["load", "document", "meta", "links", "automation"]),
  label: z.string().min(1),
  headline: z.string().min(1),
  score: z.number().int().min(0).max(100).nullable(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  ran: z.number().int().nonnegative(),
  findings: z.array(findingSchema).min(1).max(16),
});

export type Category = z.infer<typeof categorySchema>;

export const scenarioSchema = z.object({
  id: z.string().regex(/^TC-\d+$/),
  name: z.string().min(1),
  control: z.string().min(1),
  requestedUrl: z.string().min(1),
  finalUrl: z.string().min(1),
  status: z.number().int(),
  ms: z.number().int().nonnegative(),
  title: z.string().nullable(),
  passed: z.boolean(),
  description: z.string().min(1),
  preconditions: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
  testData: z.string().min(1),
  expected: z.string().min(1),
  actual: z.string().min(1),
});

export type Scenario = z.infer<typeof scenarioSchema>;

export const auditReportSchema = z.object({
  requestedUrl: z.string().min(1),
  finalUrl: z.string().min(1),
  fetchedAt: z.string().min(1),
  summary: z.string().min(1),
  scores: z.object({
    passedPercent: z.number().int().min(0).max(100),
    passedCount: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    homepageStatus: z.number().int(),
    homepageMs: z.number().int().nonnegative(),
  }),
  limits: z.object({
    maxPages: z.number().int().positive(),
    maxDepth: z.number().int().positive(),
    opened: z.number().int().nonnegative(),
    capSeconds: z.number().int().positive(),
    remaining: z.number().int().nonnegative(),
  }),
  categories: z.array(categorySchema).length(5),
  scenarios: z.array(scenarioSchema).min(1).max(200),
});

export type AuditReport = z.infer<typeof auditReportSchema>;

export const PRECONDITIONS =
  "Role: public visitor, not signed in. Booking may be opened through checkout. Guest details, card details, and payment are not entered or submitted.";
