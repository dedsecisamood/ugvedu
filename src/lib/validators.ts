/**
 * Shared Zod schemas. All API inputs must be validated with one of these
 * (or a resource-local schema built from these primitives).
 */
import { z } from "zod";
import { ROLES } from "./constants";

export const uuidSchema = z.string().uuid();

export const emailSchema = z.string().email().max(320);

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128);

export const roleSchema = z.enum(ROLES);

export const studentIdSchema = z
  .string()
  .regex(/^[A-Z0-9-]{4,20}$/i, "Invalid student ID format");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;
