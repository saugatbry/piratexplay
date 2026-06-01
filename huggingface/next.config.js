/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: ['cheerio', 'axios', 'https-proxy-agent'],
};

module.exports = nextConfig;
