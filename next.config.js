/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This forces Next.js to use the raw Square library files instead of bundling them
  serverExternalPackages: ["square", "better-sqlite3"],
  // Use standalone output for Docker
  output: "standalone",
};

module.exports = nextConfig;
