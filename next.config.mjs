/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    nodeMiddleware: true, // Enable Node.js middleware
  },
}
export default nextConfig
