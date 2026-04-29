import { z } from 'zod';

/**
 * Standard search query validation
 */
export const SearchQuerySchema = z.string()
  .min(2, "Search query must be at least 2 characters")
  .max(64, "Search query is too long")
  // Escape `-` inside the character class to avoid invalid ranges.
  .regex(/^[^;\/\*\-\\]+$/, "Invalid characters in search query");

/**
 * Class code validation (Ma Lop)
 */
export const MaLopSchema = z.string()
  .min(2)
  .max(50)
  .regex(/^[a-zA-Z0-9\s.\-_]+$/, "Invalid characters in class code");

/**
 * Student ID validation (MSV)
 */
export const MsvSchema = z.string()
  .min(5)
  .max(20)
  .regex(/^[a-zA-Z0-9]+$/, "Invalid characters in student ID");

/**
 * Common ID validation (Generic)
 */
export const IdSchema = z.union([
  z.string().regex(/^\d+$/).transform(Number),
  z.number().positive()
]);

/**
 * Profile update validation
 */
export const ProfileUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).trim()
});
