/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This forces Next.js to use the raw Square library files instead of bundling them
  serverExternalPackages: ["square"],
};

module.exports = nextConfig;
