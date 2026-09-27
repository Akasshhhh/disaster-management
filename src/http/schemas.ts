import { z } from "zod";

export const roleSchema = z.enum(["ADMIN", "CONTRIBUTOR"]);
export const statusSchema = z.enum(["active", "contained", "resolved"]);
export const resourceTypeSchema = z.enum([
  "shelter",
  "hospital",
  "food",
  "water",
  "rescue",
]);

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

const tagsSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .default([]);

export const createDisasterSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  tags: tagsSchema,
  status: statusSchema.optional(),
});

export const updateDisasterSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    tags: tagsSchema.optional(),
    status: statusSchema.optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field must be provided.",
  );

export const disasterListSchema = z.object({
  tag: z.string().trim().min(1).max(40).optional(),
  status: statusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const queryNumber = z
  .string()
  .trim()
  .min(1)
  .transform(Number)
  .pipe(z.number().finite());

export const nearbyQuerySchema = z.object({
  lat: queryNumber.pipe(z.number().min(-90).max(90)),
  lng: queryNumber.pipe(z.number().min(-180).max(180)),
  radius: queryNumber.pipe(z.number().gt(0).max(100)),
  type: resourceTypeSchema.optional(),
});

export const uuidSchema = z.string().uuid();
