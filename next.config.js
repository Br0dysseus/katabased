/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals = [...(Array.isArray(config.externals) ? config.externals : []), 'pino-pretty', 'lokijs', 'encoding'];
    return config;
  },
};

module.exports = nextConfig;
