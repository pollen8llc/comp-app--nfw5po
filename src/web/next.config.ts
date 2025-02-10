import type { NextConfig } from 'next'
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from 'next/constants'

// @ts-ignore - Next.js version 13.0+
const defineNextConfig = (phase: string): NextConfig => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER
  const isProd = phase === PHASE_PRODUCTION_BUILD

  const securityHeaders = [
    {
      key: 'X-DNS-Prefetch-Control',
      value: 'on'
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload'
    },
    {
      key: 'X-Frame-Options',
      value: 'DENY'
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff'
    },
    {
      key: 'Referrer-Policy',
      value: 'origin-when-cross-origin'
    },
    {
      key: 'X-XSS-Protection',
      value: '1; mode=block'
    },
    {
      key: 'Content-Security-Policy',
      value: "default-src 'self'; script-src 'self' 'unsafe-eval' clerk.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: clerk.com s3.amazonaws.com; font-src 'self'; connect-src 'self' clerk.com *.clerk.com; frame-src clerk.com; frame-ancestors 'none';"
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    }
  ]

  return {
    reactStrictMode: true,
    poweredByHeader: false,

    env: {
      API_BASE_URL: process.env.API_BASE_URL,
      API_VERSION: process.env.API_VERSION,
      CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY,
      NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID
    },

    async headers() {
      return [
        {
          source: '/:path*',
          headers: securityHeaders
        }
      ]
    },

    async rewrites() {
      return [
        {
          source: '/api/members/:path*',
          destination: '/api/v1/members/:path*'
        },
        {
          source: '/api/events/:path*',
          destination: '/api/v1/events/:path*'
        },
        {
          source: '/api/analytics/:path*',
          destination: '/api/v1/analytics/:path*'
        },
        {
          source: '/api/graph/:path*',
          destination: '/api/v1/graph/:path*'
        }
      ]
    },

    images: {
      domains: ['clerk.com', 's3.amazonaws.com'],
      deviceSizes: [320, 768, 1024, 1440],
      imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
      formats: ['image/avif', 'image/webp'],
      minimumCacheTTL: 60,
      dangerouslyAllowSVG: false,
      contentSecurityPolicy: "script-src 'none'; frame-src 'none'; sandbox;"
    },

    swcMinify: true,

    compiler: {
      removeConsole: {
        exclude: ['error', 'warn']
      },
      emotion: true
    },

    experimental: {
      serverActions: true,
      typedRoutes: true,
      optimizeCss: true,
      scrollRestoration: true,
      legacyBrowsers: false
    },

    webpack: (config) => {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000
        }
      }
      return config
    }
  }
}

export default defineNextConfig