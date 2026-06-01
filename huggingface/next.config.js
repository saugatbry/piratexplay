/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['cheerio', 'axios'],
};

module.exports = nextConfig;
