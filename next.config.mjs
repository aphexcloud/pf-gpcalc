/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This is the FIX: It stops Next.js from breaking the Square library
  serverExternalPackages: ["square"],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;