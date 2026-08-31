import { z } from "zod";
export const localeSchema = z.enum(["en", "ar"]);
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s\-()]{7,20}$/);
export const passwordSchema = z
  .string()
  .min(10)
  .regex(/[A-Za-z]/)
  .regex(/[0-9]/);
export const signInSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
  locale: localeSchema,
  next: z.string().optional(),
});
export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2).max(200),
    email: z.email().trim().toLowerCase(),
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    locale: localeSchema,
    website: z.string().max(0).optional(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export const emailSchema = z.object({
  email: z.email().trim().toLowerCase(),
  locale: localeSchema,
});
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
    locale: localeSchema,
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
