import { z } from "zod";

const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const nullableUrl = z.string().url("Enter a valid URL, or use null when no URL is available.").nullable().optional();
const nullableText = z.string().max(2000).nullable().optional();
const equipmentDetailsSchema = z.object({
  primaryEquipment: nullableText,
  equipmentType: nullableText,
  machineName: nullableText,
  alternativeEquipment: z.union([z.array(z.string().trim().min(1).max(100)), z.string().max(1000)]).nullable().optional(),
  setupInstructions: z.string().max(4000).nullable().optional(),
  equipmentImageUrl: nullableUrl,
}).partial().nullable().optional().transform((value) => ({
  primaryEquipment: value?.primaryEquipment ?? null,
  equipmentType: value?.equipmentType ?? null,
  machineName: value?.machineName ?? null,
  alternativeEquipment: value?.alternativeEquipment ?? null,
  setupInstructions: value?.setupInstructions ?? null,
  equipmentImageUrl: value?.equipmentImageUrl ?? null,
}));
const mediaSchema = z.object({
  type: z.enum(["gif", "video", "image", "none"]).optional(),
  animationUrl: nullableUrl,
  thumbnailUrl: nullableUrl,
  videoUrl: nullableUrl,
  altText: nullableText,
  sourceName: nullableText,
  sourceUrl: nullableUrl,
  attribution: nullableText,
}).partial().nullable().optional().transform((value) => ({
  type: value?.type ?? (value?.videoUrl ? "video" : value?.animationUrl ? "gif" : value?.thumbnailUrl ? "image" : "none"),
  animationUrl: value?.animationUrl ?? null,
  thumbnailUrl: value?.thumbnailUrl ?? null,
  videoUrl: value?.videoUrl ?? null,
  altText: value?.altText ?? null,
  sourceName: value?.sourceName ?? null,
  sourceUrl: value?.sourceUrl ?? null,
  attribution: value?.attribution ?? null,
}));

export const exercisePlanSchema = z.object({
  exerciseId: z.string().trim().min(1).max(80).optional(),
  exerciseName: z.string().trim().min(1, "Exercise name is required").max(160),
  muscleGroup: z.string().trim().min(1, "Muscle group is required").max(80),
  exerciseType: z.string().trim().min(1).max(80).default("Strength"),
  targetMuscles: z.array(z.string().trim().min(1).max(80)).default([]),
  description: z.string().max(4000).default(""),
  equipment: z.array(z.string().trim().min(1).max(100)).default([]),
  sets: z.number().int().min(0).max(100),
  reps: z.object({ min: z.number().int().min(0).nullable(), max: z.number().int().min(0).nullable() }).nullable().optional(),
  durationSeconds: z.number().int().min(0).nullable().optional(),
  restSeconds: z.number().int().min(0).max(3600).default(0),
  breathing: z.string().max(2000).default(""),
  commonMistakes: z.array(z.string().max(500)).default([]),
  trainerNotes: z.string().max(2000).default(""),
  imageUrl: nullableUrl,
  videoUrl: nullableUrl,
  equipmentDetails: equipmentDetailsSchema,
  media: mediaSchema,
}).superRefine((exercise, context) => {
  if (exercise.reps?.min != null && exercise.reps.max != null && exercise.reps.min > exercise.reps.max) {
    context.addIssue({ code: "custom", path: ["reps", "max"], message: "Maximum repetitions must be at least the minimum." });
  }
});

export const workoutDaySchema = z.object({
  day: z.enum(weekdayNames),
  focus: z.string().trim().max(160).default("Recovery"),
  exercises: z.array(exercisePlanSchema).max(80),
});

export const workoutPlanSchema = z.object({
  planId: z.string().trim().max(120).optional(),
  planName: z.string().trim().min(1, "Plan name is required").max(120),
  userId: z.string().trim().max(120).optional(),
  version: z.number().int().positive().optional(),
  workoutDays: z.array(workoutDaySchema).length(7, "A plan must include exactly seven weekdays."),
}).superRefine((plan, context) => {
  const seen = new Set<string>();
  plan.workoutDays.forEach((day, index) => {
    if (seen.has(day.day)) context.addIssue({ code: "custom", path: ["workoutDays", index, "day"], message: `${day.day} appears more than once.` });
    seen.add(day.day);
  });
  for (const day of weekdayNames) if (!seen.has(day)) context.addIssue({ code: "custom", path: ["workoutDays"], message: `${day} is missing.` });
});

export type WorkoutPlanInput = z.infer<typeof workoutPlanSchema>;
export type WorkoutDayInput = z.infer<typeof workoutDaySchema>;
export type ExercisePlanInput = z.infer<typeof exercisePlanSchema>;
export const weekdays = weekdayNames;
