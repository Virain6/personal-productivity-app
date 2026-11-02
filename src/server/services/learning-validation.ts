import { scheduleConfig } from "./study-schedule-validation";
import { z } from "zod";
import { stepStatuses } from "../../lib/learning-types";
import { validDate } from "../../lib/dates";
const category = z.string().trim().min(1).max(80).optional();
const color = z
  .enum(["purple", "blue", "green", "orange", "pink", "cyan", "red", "yellow"])
  .optional();
const description = z.string().trim().max(2000).optional();
const objective = z.string().trim().max(500).optional();
const targetDate = z
  .string()
  .refine(validDate, "Use a valid target date.")
  .nullable()
  .optional();
const title = z.string().trim().min(1).max(160);
const id = z.string().min(1).max(100);
const resourceUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Use an HTTP or HTTPS resource URL without credentials.");
const operation = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("edit"),
    title,
    category,
    color,
    description,
    goal: objective,
    targetDate,
  }),
  z.object({ kind: z.literal("archive"), archived: z.boolean() }),
  z.object({
    kind: z.literal("sectionAdd"),
    title,
    description,
    objective,
    resourceUrl: resourceUrl.optional(),
  }),
  z.object({
    kind: z.literal("sectionEdit"),
    id,
    title,
    description,
    objective,
    resourceUrl: resourceUrl.optional(),
  }),
  z.object({ kind: z.literal("sectionDelete"), id }),
  z.object({ kind: z.literal("sectionArchive"), id, archived: z.boolean() }),
  z.object({
    kind: z.literal("stepAdd"),
    sectionId: id,
    title,
    resourceUrl,
    description,
    objective,
  }),
  z.object({
    kind: z.literal("stepEdit"),
    id,
    title,
    resourceUrl,
    description,
    objective,
  }),
  z.object({ kind: z.literal("stepDelete"), id }),
  z.object({ kind: z.literal("status"), id, status: z.enum(stepStatuses) }),
  z.object({ kind: z.literal("complete"), id, completed: z.boolean() }),
  z.object({ kind: z.literal("current"), id: id.nullable() }),
  z.object({
    kind: z.literal("reorder"),
    sectionId: id.nullable(),
    ids: z.array(id).max(1000),
  }),
]);
export const learningCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("roadmapCreate"),
    schedule: scheduleConfig.optional(),
    title,
    category,
    color,
    description,
    goal: objective,
    targetDate,
  }),
  z.object({
    action: z.literal("roadmapChange"),
    id,
    version: z.number().int().positive(),
    operation,
  }),
]);
export type LearningCommand = z.infer<typeof learningCommand>;
