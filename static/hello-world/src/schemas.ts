import { z } from "zod";
export const evidenceSchema = z
  .array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      evidence: z.enum(["CONFIRMED", "INFERRED", "UNKNOWN"]),
      source: z.string().min(1),
      detail: z.string().min(1),
    }),
  )
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    "Duplicate evidence node IDs",
  );
export const comparisonSchema = z
  .array(
    z.object({
      id: z.enum(["A", "B", "C"]),
      result: z.object({
        name: z.string().min(1),
        risk: z.string().min(1),
        violations: z.number().int().nonnegative(),
        blockers: z.array(z.string()),
        summary: z.string(),
        mitigations: z.array(z.string()),
      }),
    }),
  )
  .refine(
    (items) =>
      new Set(items.map((item) => item.id)).size === 3 && items.length === 3,
    "Complete A/B/C comparison required",
  );
export const projectsSchema = z.array(
  z.object({ id: z.string().min(1), name: z.string().min(1) }),
);
export const capabilitiesSchema = z.object({
  mode: z.enum(["demo", "forge"]),
  execution: z.boolean(),
});
