import { env } from "@crikket/env/web"
import { initPostHog } from "@crikket/shared/lib/posthog"
import { init } from "@crikket-io/capture"

const isValidKey = (key?: string) =>
  Boolean(key && !key.includes("__") && !key.includes("CRIKKET_CAPTURE"))

if (isValidKey(env.NEXT_PUBLIC_CRIKKET_KEY)) {
  init({
    key: env.NEXT_PUBLIC_CRIKKET_KEY!,
    host: env.NEXT_PUBLIC_SERVER_URL,
  })
}

initPostHog({
  key: env.NEXT_PUBLIC_POSTHOG_KEY,
  host: env.NEXT_PUBLIC_POSTHOG_HOST,
})
