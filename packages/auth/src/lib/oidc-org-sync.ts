import { db } from "@crikket/db"
import { account, member, session, user } from "@crikket/db/schema/auth"
import { env } from "@crikket/env/server"
import { and, eq } from "drizzle-orm"
import { nanoid } from "nanoid"

/**
 * Extracts OIDC groups from a userinfo profile object.
 * Supports various OIDC provider schemas (Gitea, Keycloak, Authentik, GitLab, Casdoor).
 */
export function extractOidcGroups(profile: Record<string, unknown>): string[] {
  const rawGroups =
    profile.groups ??
    profile.teams ??
    profile.roles ??
    profile.orgs ??
    profile.groups_list ??
    profile["https://crikket.io/groups"]

  if (Array.isArray(rawGroups)) {
    return rawGroups
      .map((item) => {
        if (typeof item === "string") return item
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>
          return (
            (obj.name as string) ??
            (obj.slug as string) ??
            (obj.group as string) ??
            (obj.path as string) ??
            (obj.username as string)
          )
        }
        return null
      })
      .filter((g): g is string => typeof g === "string" && g.trim().length > 0)
  }

  if (typeof rawGroups === "string") {
    return rawGroups
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean)
  }

  return []
}

/**
 * Parses groups from a JWT idToken payload.
 */
export function parseJwtIdTokenGroups(idToken?: string): string[] {
  if (!idToken) return []
  try {
    const parts = idToken.split(".")
    if (parts.length < 2 || !parts[1]) return []

    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = Buffer.from(base64, "base64").toString("utf-8")
    const payload = JSON.parse(jsonPayload) as Record<string, unknown>

    return extractOidcGroups(payload)
  } catch {
    return []
  }
}

/**
 * Fetches organizations and teams directly from Gitea REST API if available.
 */
export async function fetchGiteaUserOrgsAndTeams(
  issuerUrl: string,
  accessToken: string
): Promise<string[]> {
  const groups: string[] = []
  const issuerBase = issuerUrl.replace(/\/$/, "")

  // Fetch /api/v1/user/orgs (Gitea API)
  try {
    const orgsRes = await fetch(`${issuerBase}/api/v1/user/orgs`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (orgsRes.ok) {
      const orgs = (await orgsRes.json()) as Array<Record<string, unknown>>
      for (const org of orgs) {
        const name = (org.username as string) ?? (org.name as string) ?? (org.full_name as string)
        if (typeof name === "string" && name.trim()) {
          groups.push(name.trim())
        }
      }
    }
  } catch {}

  // Fetch /api/v1/user/teams (Gitea API)
  try {
    const teamsRes = await fetch(`${issuerBase}/api/v1/user/teams`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (teamsRes.ok) {
      const teams = (await teamsRes.json()) as Array<Record<string, unknown>>
      for (const team of teams) {
        const name = team.name as string
        if (typeof name === "string" && name.trim()) {
          groups.push(name.trim())
        }
        if (typeof team.organization === "object" && team.organization !== null) {
          const org = team.organization as Record<string, unknown>
          const orgName = (org.username as string) ?? (org.name as string)
          if (typeof orgName === "string" && orgName.trim()) {
            groups.push(orgName.trim())
          }
        }
      }
    }
  } catch {}

  return groups
}

/**
 * Extracts OIDC avatar picture URL from a userinfo profile object.
 */
export function extractOidcAvatar(
  profile: Record<string, unknown>
): string | undefined {
  const avatar =
    profile.picture ??
    profile.avatar_url ??
    profile.avatar ??
    profile.image

  if (typeof avatar === "string" && avatar.trim().length > 0) {
    return avatar.trim()
  }

  return undefined
}

/**
 * Normalizes a group string into a clean lowercase slug.
 * E.g., "ADS-Digital-Partner" -> "ads-digital-partner"
 * E.g., "/owners" -> "owners"
 */
export function normalizeGroupSlug(groupName: string): string {
  return groupName
    .trim()
    .replace(/^\//, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Synchronizes an OIDC user's groups to existing Crikket organizations and optionally syncs avatar image.
 *
 * 1. Converts OIDC group names to lowercase slugs (e.g. ADS-Digital-Partner -> ads-digital-partner).
 * 2. Matches group slugs against existing organizations in Crikket DB.
 * 3. Automatically adds the user as a member to any matching organization.
 * 4. Assigns role "admin" if any group matches CUSTOM_OIDC_ADMIN_GROUPS (e.g. owners), otherwise "member".
 * 5. Sets activeOrganizationId if the user has no active organization selected.
 * 6. Syncs profile avatar picture to user.image if CUSTOM_OIDC_SYNC_AVATAR is enabled (default: true).
 */
export async function syncOidcUserToOrganizations(input: {
  userId: string
  accessToken?: string
  idToken?: string
  rawGroups?: string[]
}): Promise<{ syncedOrganizationsCount: number }> {
  const groupSet = new Set<string>(input.rawGroups ?? [])

  // Parse idToken payload for claims
  if (input.idToken) {
    const idTokenGroups = parseJwtIdTokenGroups(input.idToken)
    for (const g of idTokenGroups) {
      groupSet.add(g)
    }
  }

  // If accessToken is present, fetch userinfo & Gitea API endpoints
  if (input.accessToken && env.CUSTOM_OIDC_ISSUER_URL) {
    try {
      const userinfoUrl = `${env.CUSTOM_OIDC_ISSUER_URL.replace(/\/$/, "")}/userinfo`
      const response = await fetch(userinfoUrl, {
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
        },
      })

      if (response.ok) {
        const profile = (await response.json()) as Record<string, unknown>
        const userinfoGroups = extractOidcGroups(profile)
        for (const g of userinfoGroups) {
          groupSet.add(g)
        }

        // Sync avatar image if enabled
        const shouldSyncAvatar = env.CUSTOM_OIDC_SYNC_AVATAR ?? true
        if (shouldSyncAvatar) {
          const avatarUrl = extractOidcAvatar(profile)
          if (avatarUrl) {
            await db
              .update(user)
              .set({ image: avatarUrl })
              .where(eq(user.id, input.userId))
          }
        }
      }
    } catch {
      // Ignore userinfo fetch errors silently
    }

    // Try fetching Gitea API orgs/teams
    try {
      const giteaGroups = await fetchGiteaUserOrgsAndTeams(
        env.CUSTOM_OIDC_ISSUER_URL,
        input.accessToken
      )
      for (const g of giteaGroups) {
        groupSet.add(g)
      }
    } catch {}
  }

  const groups = Array.from(groupSet)
  if (groups.length === 0) {
    return { syncedOrganizationsCount: 0 }
  }

  const adminGroupNames = env.CUSTOM_OIDC_ADMIN_GROUPS ?? ["owners", "admin", "admins"]

  // Map each OIDC group name to a normalized slug and raw lowercase string
  const groupSlugs = groups
    .map((g) => normalizeGroupSlug(g))
    .filter((s) => s.length > 0)

  const rawGroupLower = groups.map((g) => g.trim().toLowerCase())

  if (groupSlugs.length === 0) {
    return { syncedOrganizationsCount: 0 }
  }

  // Check if user has any group designated as admin (e.g., "owners")
  const hasAdminGroup = rawGroupLower.some((g) =>
    adminGroupNames.includes(g)
  ) || groupSlugs.some((s) => adminGroupNames.includes(s))

  const targetRole = hasAdminGroup ? "admin" : "member"

  // Fetch all existing organizations matching any of the group slugs or names
  const allOrgs = await db.query.organization.findMany()
  const matchingOrgs = allOrgs.filter((org) => {
    const orgSlug = org.slug.toLowerCase()
    const orgNameLower = org.name.toLowerCase()
    return groupSlugs.includes(orgSlug) || rawGroupLower.includes(orgNameLower)
  })

  let syncedCount = 0

  for (const org of matchingOrgs) {
    const existingMember = await db.query.member.findFirst({
      where: and(
        eq(member.organizationId, org.id),
        eq(member.userId, input.userId)
      ),
    })

    if (!existingMember) {
      await db.insert(member).values({
        id: nanoid(12),
        organizationId: org.id,
        userId: input.userId,
        role: targetRole,
        createdAt: new Date(),
      })
      syncedCount++
    } else if (hasAdminGroup && existingMember.role !== "admin" && existingMember.role !== "owner") {
      await db
        .update(member)
        .set({ role: "admin" })
        .where(eq(member.id, existingMember.id))
      syncedCount++
    }
  }

  // Ensure activeOrganizationId is set on active sessions if user has matched orgs
  const firstOrg = matchingOrgs[0]
  if (firstOrg) {
    const userSessions = await db.query.session.findMany({
      where: eq(session.userId, input.userId),
    })

    for (const userSession of userSessions) {
      if (!userSession.activeOrganizationId) {
        await db
          .update(session)
          .set({ activeOrganizationId: firstOrg.id })
          .where(eq(session.id, userSession.id))
      }
    }
  }

  return { syncedOrganizationsCount: syncedCount }
}

/**
 * Convenience helper to sync OIDC organizations for a user by userId.
 */
export async function syncOidcUserToOrganizationsForUser(userId: string) {
  const oidcAccount = await db.query.account.findFirst({
    where: and(
      eq(account.userId, userId),
      eq(account.providerId, "custom-oidc")
    ),
  })

  if (!oidcAccount) {
    return { syncedOrganizationsCount: 0 }
  }

  return await syncOidcUserToOrganizations({
    userId,
    accessToken: oidcAccount.accessToken ?? undefined,
    idToken: oidcAccount.idToken ?? undefined,
  })
}
