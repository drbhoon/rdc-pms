/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow larger API responses (sheets can be big)
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
