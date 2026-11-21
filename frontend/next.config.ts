import type { NextConfig } from "next";

/**
 * Security headers follow docs/SECURITY_PRIVACY.md (Agent 12).
 * The CSP is fixed at build time: NEXT_PUBLIC_API_BASE_URL and
 * NEXT_PUBLIC_HAND_MODEL_URL must be set when `next build` runs.
 */

const isDev = process.env.NODE_ENV === "development";

const DEFAULT_HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/** Origin of an absolute http(s) URL, or null for relative/invalid values. */
function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    return /^https?:$/.test(u.protocol) ? u.origin : null;
  } catch {
    return null;
  }
}

/** Origin plus directory of an absolute http(s) URL (CSP path prefix), or null. */
function dirSourceOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (!/^https?:$/.test(u.protocol)) return null;
    return u.origin + u.pathname.slice(0, u.pathname.lastIndexOf("/") + 1);
  } catch {
    return null;
  }
}

const apiOrigin = originOf(
  process.env.NEXT_PUBLIC_API_BASE_URL ?? (isDev ? "http://localhost:8000" : ""),
);
// A same-origin model path such as "/models/hand_landmarker.task" yields null and adds nothing.
const modelSource = dirSourceOf(process.env.NEXT_PUBLIC_HAND_MODEL_URL ?? DEFAULT_HAND_MODEL_URL);

const connectSrc = [
  "'self'",
  "blob:",
  "data:",
  apiOrigin,
  modelSource,
  // Development only: HMR websocket and a local API on any port.
  ...(isDev
    ? ["ws://localhost:*", "ws://127.0.0.1:*", "http://localhost:*", "http://127.0.0.1:*"]
    : []),
].filter((v): v is string => Boolean(v));

const contentSecurityPolicy = [
  "default-src 'self'",
  // 'unsafe-eval' is development only (React dev tooling).
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  `connect-src ${[...new Set(connectSrc)].join(" ")}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'none'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Production only: would rewrite http://localhost API calls in development.
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(), geolocation=(), display-capture=(), payment=(), usb=(), serial=(), bluetooth=(), midi=(), accelerometer=(), gyroscope=(), magnetometer=(), browsing-topics=()",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  // Production only: never send HSTS from a development server.
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
