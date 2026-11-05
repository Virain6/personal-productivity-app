import { z } from "zod";
import { validDate } from "../../lib/dates";
const date = z.string().refine(validDate, "Choose a valid date.");
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();
export const generalConfig = z
  .object({
    title: z.string().trim().min(1).max(160),
    summary: z.string().max(500),
    weekday: z.number().int().min(1).max(7),
    time,
    minutes: z.number().int().min(1).max(1440),
    optional: z.boolean(),
  })
  .strict();
export const calendarCommand = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("generalScheduleSave"),
      templateId: z.string().optional(),
      version: z.number().int().min(0),
      effectiveFrom: date,
      config: generalConfig,
    })
    .strict(),
  z
    .object({
      action: z.literal("moveTask"),
      id: z.string(),
      version: z.number().int().positive(),
      date,
      time,
    })
    .strict(),
]);
export type CalendarCommand = z.infer<typeof calendarCommand>;
