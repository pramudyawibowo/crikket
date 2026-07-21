import { describe, expect, it } from "bun:test"
import {
  extractOidcAvatar,
  extractOidcGroups,
  normalizeGroupSlug,
  parseJwtIdTokenGroups,
} from "../src/lib/oidc-org-sync"

describe("extractOidcGroups", () => {
  it("extracts groups from array of strings", () => {
    const profile = { groups: ["ADS-Digital-Partner", "owners", "devs"] }
    expect(extractOidcGroups(profile)).toEqual(["ADS-Digital-Partner", "owners", "devs"])
  })

  it("extracts groups from array of objects (Gitea / Keycloak format)", () => {
    const profile = {
      groups: [
        { name: "ADS-Digital-Partner" },
        { slug: "marketing" },
        { path: "/owners" },
      ],
    }
    expect(extractOidcGroups(profile)).toEqual(["ADS-Digital-Partner", "marketing", "/owners"])
  })

  it("extracts groups from teams or roles property", () => {
    const profileTeams = { teams: ["ADS-Digital-Partner"] }
    expect(extractOidcGroups(profileTeams)).toEqual(["ADS-Digital-Partner"])

    const profileRoles = { roles: ["owners"] }
    expect(extractOidcGroups(profileRoles)).toEqual(["owners"])
  })

  it("extracts groups from comma-separated string", () => {
    const profile = { groups: "ADS-Digital-Partner, owners, team-b" }
    expect(extractOidcGroups(profile)).toEqual(["ADS-Digital-Partner", "owners", "team-b"])
  })

  it("returns empty array if no groups present", () => {
    expect(extractOidcGroups({})).toEqual([])
  })
})

describe("parseJwtIdTokenGroups", () => {
  it("decodes JWT id_token payload and extracts groups", () => {
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url")
    const payload = Buffer.from(
      JSON.stringify({
        sub: "user_123",
        groups: ["ADS-Digital-Partner", "devs"],
      })
    ).toString("base64url")
    const token = `${header}.${payload}.signature`

    expect(parseJwtIdTokenGroups(token)).toEqual(["ADS-Digital-Partner", "devs"])
  })

  it("returns empty array for invalid JWT token", () => {
    expect(parseJwtIdTokenGroups("invalid.jwt")).toEqual([])
    expect(parseJwtIdTokenGroups(undefined)).toEqual([])
  })
})

describe("extractOidcAvatar", () => {
  it("extracts avatar from picture field", () => {
    expect(
      extractOidcAvatar({ picture: "https://gitea.example.com/avatar.png" })
    ).toBe("https://gitea.example.com/avatar.png")
  })

  it("extracts avatar from avatar_url or image field", () => {
    expect(
      extractOidcAvatar({ avatar_url: "https://auth.example.com/user.jpg" })
    ).toBe("https://auth.example.com/user.jpg")
  })

  it("returns undefined if no avatar present", () => {
    expect(extractOidcAvatar({})).toBeUndefined()
  })
})

describe("normalizeGroupSlug", () => {
  it("converts Group Name to lowercase slug", () => {
    expect(normalizeGroupSlug("ADS-Digital-Partner")).toBe("ads-digital-partner")
  })

  it("strips leading slash from Keycloak group paths", () => {
    expect(normalizeGroupSlug("/owners")).toBe("owners")
    expect(normalizeGroupSlug("/ADS-Digital-Partner")).toBe("ads-digital-partner")
  })

  it("handles spaces and special characters", () => {
    expect(normalizeGroupSlug("My Custom Group!")).toBe("my-custom-group")
  })
})
