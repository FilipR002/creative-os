/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Prevent clickjacking — no embedding in iframes
  { key: 'X-Frame-Options',        value: 'DENY' },
  // Stop MIME-type sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Limit referrer information leaked to third parties
  { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
  // Disable unused browser features
  { key: 'Permissions-Policy',     value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Content Security Policy
  // Tighten if/when inline styles are moved to CSS modules
  {
    key:   'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js needs 'unsafe-inline' for its runtime scripts; tighten with nonces in future
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      // Allow Supabase and Railway API calls
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.railway.app",
      // Allow Unsplash photos (template gallery backgrounds)
      "img-src 'self' data: blob: https://images.unsplash.com https://plus.unsplash.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const config = {
  experimental: {
    turbo: {
      resolveExtensions: ['.tsx', '.ts', '.jsx', '.js'],
    },
  },

  // ── Security headers on every response ────────────────────────────────────
  async headers() {
    return [
      {
        source:  '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // ── Dev proxy: rewrites only apply when running locally ───────────────────
  // In production (Vercel), NEXT_PUBLIC_API_URL is set to the Railway URL and
  // the API clients call it directly — no proxy needed.
  async rewrites() {
    const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? '';

    // Skip rewrites if no backend URL or it's a real remote URL (production)
    if (!BACKEND || !BACKEND.includes('localhost')) return [];

    return [
      { source: '/api/:path*',              destination: `${BACKEND}/api/:path*`             },
      { source: '/autonomous-loop',         destination: `${BACKEND}/autonomous-loop`         },
      { source: '/autonomous-loop/:path*',  destination: `${BACKEND}/autonomous-loop/:path*`  },
      { source: '/angle-insights/:path*',   destination: `${BACKEND}/angle-insights/:path*`   },
      { source: '/angle-references',        destination: `${BACKEND}/angle-references`        },
      { source: '/angle-references/:path*', destination: `${BACKEND}/angle-references/:path*` },
      { source: '/product',                 destination: `${BACKEND}/product`                 },
      { source: '/product/:path*',          destination: `${BACKEND}/product/:path*`          },
    ];
  },
};

export default config;
