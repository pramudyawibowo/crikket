import posthog from "posthog-js"

type PostHogClientConfig = {
  key?: string
  host?: string
}

function isValidConfigValue(val?: string): val is string {
  if (!val) return false
  if (val.includes("__") || val.includes("CRIKKET_POSTHOG")) {
    return false
  }
  return true
}

export const initPostHog = ({ key, host }: PostHogClientConfig): void => {
  if (isValidConfigValue(key) && isValidConfigValue(host)) {
    posthog.init(key, {
      api_host: "/ph",
      ui_host: host,
      defaults: "2026-01-30",
    })
  }
}
