/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // No direct DB access from frontend — all calls go through the API
  async rewrites() {
    return [];
  },
};

export default nextConfig;
