import { z } from "zod";
import { categories } from "../../lib/planner-types";
import { validDate } from "../../lib/dates";
export const dateInput = z
  .string()
  .refine(validDate, "Use a valid YYYY-MM-DD date.");
export const taskFields = z
  .object({
    title: z.string().trim().min(1).max(160),
    category: z.enum(categories),
    plannedDate: dateInput,
    mode: z.enum(["flexible", "fixed"]),
    suggestedTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
    targetMinutes: z.number().int().min(1).max(1440),
    fixedStart: z.number().int().nullable(),
    fixedEnd: z.number().int().nullable(),
    optional: z.boolean(),
    summary: z.string().max(500),
  })
  .strict()
  .superRefine((x, ctx) => {
    if (
      x.mode === "fixed" &&
      (!x.fixedStart || !x.fixedEnd || x.fixedEnd <= x.fixedStart)
    )
      ctx.addIssue({
        code: "custom",
        message: "A fixed event needs a valid start and end.",
      });
    if (x.mode === "flexible" && (x.fixedStart !== null || x.fixedEnd !== null))
      ctx.addIssue({
        code: "custom",
        message: "Flexible tasks cannot have a fixed interval.",
      });
  });
export const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), fields: taskFields }),
  z.object({
    action: z.literal("edit"),
    id: z.string(),
    version: z.number().int(),
    fields: taskFields,
  }),
  z.object({
    action: z.literal("status"),
    id: z.string(),
    version: z.number().int(),
    status: z.enum(["pending", "done", "skipped"]),
    stopRunning: z.boolean().default(false),
  }),
  z.object({ action: z.literal("start"), id: z.string() }),
  z.object({
    action: z.literal("stop"),
    sessionId: z.string(),
    summary: z.string().max(500).default(""),
    complete: z.boolean().default(false),
    version: z.number().int().optional(),
  }),
  z.object({
    action: z.literal("manual"),
    id: z.string(),
    startedAt: z.number().int(),
    endedAt: z.number().int(),
    overlapConfirmed: z.boolean().default(false),
    summary: z.string().max(500).default(""),
  }),
]);
export const mutation = z.object({ operationKey: z.string().uuid(), command });
export class DomainError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
