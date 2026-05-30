/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    staleTimes: { dynamic: 0 },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-inline for hydration; unsafe-eval for webpack chunks
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' js.stripe.com *.googletagmanager.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              // Stripe Payment Element loads in iframes from these origins
              "frame-src js.stripe.com hooks.stripe.com",
              // Client-side connections: Stripe API, Google Analytics
              "connect-src 'self' api.stripe.com hooks.stripe.com *.google-analytics.com *.analytics.google.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
