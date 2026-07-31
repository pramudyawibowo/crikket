import "@crikket/env/web"
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "**",
      },
    ],
  },
  async rewrites() {
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (
      !posthogHost ||
      posthogHost.includes("__") ||
      posthogHost.includes("CRIKKET_POSTHOG")
    ) {
      return []
    }

    return [
      {
        source: "/ph/:path*",
        destination: `${posthogHost}/:path*`,
      },
    ]
  },
}

export default nextConfig
