// /lib/db/env.ts

import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z
    .string()
    .url("SUPABASE_URL must be a valid URL")
    .min(1, "SUPABASE_URL is required"),

  SUPABASE_ANON_KEY: z
    .string()
    .min(20, "SUPABASE_ANON_KEY must be at least 20 characters long"),
});

const parsed = envSchema.safeParse({
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.format());
  throw new Error(
    "Missing or invalid Supabase environment variables. Check SUPABASE_URL and SUPABASE_ANON_KEY."
  );
}

export const env = parsed.data;
