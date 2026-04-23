/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    turbo: {
      resolveExtensions: ['.tsx', '.ts', '.jsx', '.js'],
    },
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
