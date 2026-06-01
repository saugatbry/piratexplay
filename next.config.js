/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['cheerio', 'axios', 'playwright'],
};

module.exports = nextConfig;
