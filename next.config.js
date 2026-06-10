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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Next.js requires unsafe-inline for hydration; unsafe-eval for webpack chunks
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' js.stripe.com *.googletagmanager.com *.leadconnectorhq.com *.msgsndr.com",
              "style-src 'self' 'unsafe-inline' *.leadconnectorhq.com *.msgsndr.com",
              "img-src 'self' data: blob: *.leadconnectorhq.com *.msgsndr.com",
              "font-src 'self' data: *.leadconnectorhq.com *.msgsndr.com",
              // Stripe Payment Element + GHL chat widget load in iframes
              "frame-src js.stripe.com hooks.stripe.com *.leadconnectorhq.com *.msgsndr.com",
              // Client-side connections: Stripe API, Google Analytics, GHL chat widget
              "connect-src 'self' api.stripe.com hooks.stripe.com *.google-analytics.com *.analytics.google.com *.leadconnectorhq.com *.msgsndr.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
