import type { NextConfig } from "next";
import path from "path";

const isProduction = process.env.NODE_ENV === 'production'

// Content Security Policy — protege contra XSS e injeção de conteúdo
// 'unsafe-inline' é necessário para Next.js App Router (scripts de hidratação) e Tailwind
// 'unsafe-eval' é necessário apenas em dev para webpack HMR
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isProduction ? '' : "'unsafe-eval'"} https://*.clerk.accounts.dev https://*.clerk.com https://clerk.js.org`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' wss: ws: https://*.clerk.com https://*.clerk.accounts.dev https://api.clerk.com https://brasilapi.com.br https://www.receitaws.com.br",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.clerk.com",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Content-Security-Policy', value: csp },
  // HSTS: força HTTPS por 2 anos — apenas em produção para não quebrar desenvolvimento local
  ...(isProduction ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
]

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
};

export default nextConfig;
