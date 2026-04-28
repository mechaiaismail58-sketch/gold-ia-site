// Last deployment sync: 2026-04-15
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile ESM-only packages so SSR (Node.js) can require() them
  transpilePackages: [
    "react-markdown",
    "remark-gfm",
    "unified",
    "vfile",
    "vfile-message",
    "unist-util-stringify-position",
    "mdast-util-from-markdown",
    "mdast-util-gfm",
    "mdast-util-to-hast",
    "mdast-util-to-string",
    "mdast-util-find-and-replace",
    "mdast-util-definitions",
    "micromark",
    "micromark-extension-gfm",
    "decode-named-character-reference",
    "character-entities",
    "property-information",
    "hast-util-whitespace",
    "space-separated-tokens",
    "comma-separated-tokens",
    "hast-util-to-jsx-runtime",
    "unist-util-visit",
  ],

  // Supabase storage public URL for avatar images
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wegvgmovhcwxjqnqqjat.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options",         value: "DENY" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
