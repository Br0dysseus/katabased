/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals = [...(Array.isArray(config.externals) ? config.externals : []), 'pino-pretty', 'lokijs', 'encoding', '@react-native-async-storage/async-storage'];
    return config;
  },
};

module.exports = nextConfig;
