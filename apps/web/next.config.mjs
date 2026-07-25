/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Linting is run as a separate workspace task; don't block production builds.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
