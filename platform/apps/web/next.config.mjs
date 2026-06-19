/** @type {import('next').NextConfig} */
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001';

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Proxy /api/* to the standalone Hono API process during dev / single-server deploy.
  // This avoids cross-origin / cookie complexity while letting the api app stay independent.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_BASE}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
