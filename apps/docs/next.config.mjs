import { createMDX } from "fumadocs-mdx/next"

const withMDX = createMDX()

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    const rewrites = [
      {
        source: "/docs/:path*.mdx",
        destination: "/llms.mdx/docs/:path*",
      },
    ]

    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (
      posthogHost &&
      !posthogHost.includes("__") &&
      !posthogHost.includes("CRIKKET_POSTHOG")
    ) {
      rewrites.push({
        source: "/ph/:path*",
        destination: `${posthogHost}/:path*`,
      })
    }

    return rewrites
  },
}

export default withMDX(config)
