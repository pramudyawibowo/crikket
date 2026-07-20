import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  client: {
    NEXT_PUBLIC_SITE_URL: z.url(),
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_SERVER_URL: z.url(),
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NEXT_PUBLIC_CUSTOM_OIDC_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NEXT_PUBLIC_CUSTOM_OIDC_PROVIDER_NAME: z.string().optional(),
    NEXT_PUBLIC_STORAGE_UPLOAD_MODE: z
      .enum(["auto", "proxy", "direct"])
      .default("auto"),
    NEXT_PUBLIC_STORAGE_UPLOAD_CHUNK_SIZE_MB: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(50),
    NEXT_PUBLIC_CRIKKET_KEY: z.string().optional(),
    NEXT_PUBLIC_DEMO_URL: z.url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.url().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    NEXT_PUBLIC_GOOGLE_AUTH_ENABLED:
      process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED,
    NEXT_PUBLIC_CUSTOM_OIDC_ENABLED:
      process.env.NEXT_PUBLIC_CUSTOM_OIDC_ENABLED,
    NEXT_PUBLIC_CUSTOM_OIDC_PROVIDER_NAME:
      process.env.NEXT_PUBLIC_CUSTOM_OIDC_PROVIDER_NAME,
    NEXT_PUBLIC_STORAGE_UPLOAD_MODE:
      process.env.NEXT_PUBLIC_STORAGE_UPLOAD_MODE,
    NEXT_PUBLIC_STORAGE_UPLOAD_CHUNK_SIZE_MB:
      process.env.NEXT_PUBLIC_STORAGE_UPLOAD_CHUNK_SIZE_MB,
    NEXT_PUBLIC_CRIKKET_KEY: process.env.NEXT_PUBLIC_CRIKKET_KEY,
    NEXT_PUBLIC_DEMO_URL: process.env.NEXT_PUBLIC_DEMO_URL,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  emptyStringAsUndefined: true,
})
