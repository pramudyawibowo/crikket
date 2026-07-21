import { env } from "@crikket/env/server"
import { publicProcedure } from "./context"

export const getPublicAuthConfigProcedure = publicProcedure.handler(() => {
  const isGoogleAuthEnabled = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
  )
  const isCustomOidcEnabled = Boolean(
    env.CUSTOM_OIDC_CLIENT_ID &&
      env.CUSTOM_OIDC_CLIENT_SECRET &&
      env.CUSTOM_OIDC_ISSUER_URL
  )
  const customOidcProviderName = env.CUSTOM_OIDC_PROVIDER_NAME ?? "SSO"

  return {
    isGoogleAuthEnabled,
    isCustomOidcEnabled,
    customOidcProviderName,
  }
})
