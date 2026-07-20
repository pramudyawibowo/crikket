import { env } from "@crikket/env/web"
import { polarClient } from "@polar-sh/better-auth"
import type { BetterAuthClientOptions } from "better-auth/client"
import {
  adminClient,
  emailOTPClient,
  organizationClient,
} from "better-auth/client/plugins"
import { genericOAuthClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

const adminPlugin = adminClient()
const emailOtpPlugin = emailOTPClient()
const organizationPlugin = organizationClient()
const polarPlugin: ReturnType<typeof polarClient> = polarClient()
const genericOAuthPlugin = genericOAuthClient()

type AuthClientOptions = {
  baseURL: string
  plugins: [
    typeof adminPlugin,
    typeof emailOtpPlugin,
    typeof organizationPlugin,
    typeof polarPlugin,
    typeof genericOAuthPlugin,
  ]
}

type AuthClient<Option extends BetterAuthClientOptions> = ReturnType<
  typeof createAuthClient<Option>
>

export const authClient: AuthClient<AuthClientOptions> = createAuthClient({
  baseURL: env.NEXT_PUBLIC_SERVER_URL,
  plugins: [adminPlugin, emailOtpPlugin, organizationPlugin, polarPlugin, genericOAuthPlugin],
})
