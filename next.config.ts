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
    const csp = [
      "default-src 'self'",
      // Next.js App Router requires unsafe-inline for its runtime hydration scripts
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://wegvgmovhcwxjqnqqjat.supabase.co",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://api.twelvedata.com https://api.stlouisfed.org https://newsdata.io https://api.anthropic.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy",  value: csp },
          { key: "X-Frame-Options",          value: "DENY" },
          { key: "X-Content-Type-Options",   value: "nosniff" },
          { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
