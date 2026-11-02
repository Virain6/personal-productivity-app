import { z } from "zod";
import { validDate } from "../../lib/dates";
const id = z.string().min(1).max(100);
export const scheduleConfig = z.object({
  weekdays: z
    .array(z.number().int().min(1).max(7))
    .min(1)
    .max(7)
    .refine((a) => new Set(a).size === a.length, "Choose each weekday once."),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  minutes: z.number().int().min(1).max(1440),
  paused: z.boolean(),
  removed: z.boolean(),
});
export const studyScheduleCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("studyScheduleSave"),
    id: id.optional(),
    version: z.number().int().positive().optional(),
    roadmapId: id,
    sectionId: id.nullable(),
    templateId: id.optional(),
    config: scheduleConfig,
  }),
  z.object({
    action: z.literal("studyTask"),
    roadmapId: id.optional(),
    stepId: id.nullable().optional(),
    startNow: z.boolean().optional(),
    additional: z.boolean().optional(),
    date: z.string().refine(validDate),
    minutes: z.number().int().min(1).max(1440).optional(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable(),
  }),
]);
export type StudyScheduleCommand = z.infer<typeof studyScheduleCommand>;
