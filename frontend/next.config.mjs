/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    turbo: {
      resolveExtensions: ['.tsx', '.ts', '.jsx', '.js'],
    },
  },

  // ── Proxy: frontend (3000) → backend (4000) ───────────────────────────────
  // ALL backend traffic goes through Next.js — no hardcoded localhost:4000 in browser.
  // Covers: /api/* (main), plus controllers that have no /api/ prefix.
  async rewrites() {
    const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return [
      { source: '/api/:path*',             destination: `${BACKEND}/api/:path*`             },
      { source: '/autonomous-loop',        destination: `${BACKEND}/autonomous-loop`         },
      { source: '/autonomous-loop/:path*', destination: `${BACKEND}/autonomous-loop/:path*`  },
      { source: '/angle-insights/:path*',  destination: `${BACKEND}/angle-insights/:path*`   },
      { source: '/angle-references',       destination: `${BACKEND}/angle-references`        },
      { source: '/angle-references/:path*',destination: `${BACKEND}/angle-references/:path*` },
      { source: '/product',                destination: `${BACKEND}/product`                 },
      { source: '/product/:path*',         destination: `${BACKEND}/product/:path*`          },
    ];
  },
};

export default config;
