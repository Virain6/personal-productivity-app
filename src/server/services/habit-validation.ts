import { z } from "zod";
import { habitDirection } from "../../lib/habit-types";
import { validDate } from "../../lib/dates";
const date = z.string().refine(validDate, "Choose a valid local date.");
const quantity = z
  .number()
  .finite()
  .min(0)
  .max(1_000_000_000)
  .refine(
    (n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 0.0001,
    "Use at most three decimal places.",
  );
export const habitConfig = z
  .object({
    name: z.string().trim().min(1).max(100),
    kind: z.enum(["binary", "quantity", "workout"]),
    unit: z.string().trim().max(30),
    direction: z.enum(["build", "limit", "avoid"]).optional(),
    goal: z.enum(["awareness", "atLeast", "atMost"]),
    target: quantity.nullable(),
    quickStep: quantity
      .refine((n) => n > 0, "Quick step must be positive.")
      .nullable()
      .optional(),
    schedule: z.enum(["daily", "weekdays", "weekly"]),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7),
    timesPerWeek: z.number().int().min(1).max(7),
    rotation: z.array(z.string().trim().min(1).max(50)).max(20),
  })
  .strict()
  .superRefine((c, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (c.kind === "quantity" && !c.unit) fail("Quantity habits need a unit.");
    const direction = habitDirection(c);
    if (direction === "limit" && c.target === null)
      fail("Choose a daily limit; zero is allowed.");
    if (direction === "avoid" && c.target !== null && c.target !== 0)
      fail("Avoid habits have a limit of zero.");
    if (
      direction === "limit" &&
      c.kind !== "quantity" &&
      c.target !== 0 &&
      c.target !== 1
    )
      fail(
        "Binary and workout limits are 0 or 1 occurrence per day. Use quantity for other limits.",
      );
    if (
      direction === "build" &&
      c.kind === "quantity" &&
      c.goal !== "awareness" &&
      c.target === null
    )
      fail("Choose a target or awareness only.");
    if (c.schedule === "weekdays" && !c.weekdays.length)
      fail("Choose at least one weekday.");
    if (new Set(c.weekdays).size !== c.weekdays.length)
      fail("Weekdays cannot repeat.");
    if (c.kind === "workout" && !c.rotation.length)
      fail("Add at least one workout or Rest step.");
  })
  .transform((c) => {
    const direction = habitDirection(c);
    const target = direction === "avoid" ? 0 : c.target;
    return {
      ...c,
      direction,
      target,
      goal: (direction !== "build"
        ? "atMost"
        : c.kind === "quantity" && target !== null
          ? "atLeast"
          : "awareness") as "atMost" | "atLeast" | "awareness",
    };
  });
const base = { id: z.string().uuid(), version: z.number().int().positive() };
export const habitCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("habitQuick"),
    ...base,
    date,
    revisionId: z.string().uuid(),
    entryVersion: z.number().int().min(0),
    mode: z.enum(["toggle", "zero", "increment", "decrement"]),
  }),
  z.object({ action: z.literal("habitCreate"), config: habitConfig }),
  z.object({ action: z.literal("habitEdit"), ...base, config: habitConfig }),
  z.object({
    action: z.literal("habitArchive"),
    ...base,
    archived: z.boolean(),
  }),
  z.object({
    action: z.literal("habitNext"),
    ...base,
    nextIndex: z.number().int().min(0),
    nextDate: date.nullable(),
  }),
  z.object({
    action: z.literal("habitRecord"),
    ...base,
    date,
    revisionId: z.string().uuid(),
    entryVersion: z.number().int().min(0),
    state: z.enum(["unlogged", "done", "notDone", "rest"]),
    quantity: quantity.nullable(),
    workout: z.string().trim().max(60),
    advance: z.boolean(),
  }),
]);
export type HabitCommand = z.infer<typeof habitCommand>;
