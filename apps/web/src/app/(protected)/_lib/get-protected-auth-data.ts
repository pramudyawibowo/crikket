import { authClient } from "@crikket/auth/client"
import { headers } from "next/headers"
import { cache } from "react"

export const getProtectedAuthData = cache(async () => {
  const requestHeaders = await headers()

  const { data: session } = await authClient.getSession({
    fetchOptions: {
      headers: requestHeaders,
    },
  })

  if (!session) {
    return {
      organizations: [],
      session: null,
    }
  }

  let { data: organizations } = await authClient.organization.list({
    fetchOptions: {
      headers: requestHeaders,
    },
  })

  if ((!organizations || organizations.length === 0) && session?.user?.id) {
    try {
      const { syncOidcUserToOrganizationsForUser } = await import(
        "@crikket/auth/lib/oidc-org-sync"
      )
      const syncResult = await syncOidcUserToOrganizationsForUser(
        session.user.id
      )
      if (syncResult.syncedOrganizationsCount > 0) {
        const reList = await authClient.organization.list({
          fetchOptions: {
            headers: requestHeaders,
          },
        })
        organizations = reList.data
      }
    } catch {
      // Ignore sync errors silently
    }
  }

  return {
    organizations: organizations ?? [],
    session,
  }
})
