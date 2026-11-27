import { z } from "zod";

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
  scenarios: z.array(scenarioSchema).min(1).max(24),
});

export type AuditReport = z.infer<typeof auditReportSchema>;

export const PRECONDITIONS =
  "Role: public visitor, not signed in. Each step is a GET. No form is filled in. Checkout, payment, sign-in, and delete are not used.";
