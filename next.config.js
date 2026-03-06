// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // optional settings:
      // allowedOrigins: ['https://your-site.com'],
      // bodySizeLimit: '2mb',
    },
  },
}
module.exports = nextConfig
