import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy. Next.js injects inline bootstrap scripts, so
 * 'unsafe-inline' is required for scripts unless nonce-based CSP is adopted
 * (which forces every page to be dynamically rendered). pdf.js needs
 * 'wasm-unsafe-eval' for some image decoders and blob: workers.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  typescript: { tsconfigPath: "tsconfig.build.json" },
  // Native/WASM database drivers and pdf-lib must not be bundled by webpack.
  serverExternalPackages: ["@electric-sql/pglite", "pg", "pdf-lib"],
  experimental: {
    // Admin PDF uploads go through a Server Action (max file size is enforced in the action).
    serverActions: {
      bodySizeLimit: "30mb",
      // GitHub Codespaces' port forwarding proxies requests with Host: localhost, so Next
      // would reject form posts from the *.app.github.dev preview URL as cross-site.
      ...(process.env.CODESPACES === "true" ? { allowedOrigins: ["*.app.github.dev"] } : {}),
    },
  },
  webpack(config) {
    // pdf.js optionally requires `canvas` for Node rendering; we only render in the browser.
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/pdf.worker.min.mjs",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default nextConfig;
