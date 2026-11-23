/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-hosted deployment: emit a minimal server bundle for the Docker image.
  output: "standalone",
  // Allow the dev server on both loopback spellings; otherwise the client
  // bundle is blocked cross-origin and the page never hydrates.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  experimental: {
    // Keep this app on a version that is clear of published security
    // advisories. Set during the 16.4.2 -> 16.4.6 upgrade so `next dev` and
    // `next build` surface the reminder again when a future advisory lands,
    // instead of only failing later in CI.
    agentUpgrade: "security",
  },
  images: {
    unoptimized: true,
  },
  // `pdf-parse` ships a pdf.js worker as a separate .mjs file. Bundling it makes
  // Turbopack rewrite the worker path, and at runtime pdf.js then looks for a
  // file that does not exist ("Setting up fake worker failed"). Keeping it
  // external means Node resolves it from node_modules as the package intends.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  async redirects() {
    const hiddenCourseManagePaths = ["playback", "downloads", "defaults"]
    return hiddenCourseManagePaths.map((slug) => ({
      source: `/admin/dashboard/manage/${slug}`,
      destination: "/admin/dashboard",
      permanent: false,
    }))
  },
  // Vercel's file tracing only follows static imports, so the worker loaded by
  // pdf.js at runtime was missing from the deployed function. Copy it into
  // every route that extracts PDF text.
  outputFileTracingIncludes: {
    "/api/chat": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/courses/**": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/documents/course-bulk": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking — only allow your own site to iframe
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          // Prevent MIME type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Control referrer information
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Prevent XSS in older browsers
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // DNS prefetch control
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          // Permissions policy — disable unused browser features
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
}

export default nextConfig
