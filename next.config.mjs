/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/checklist/:slug",
        destination: "/project/:slug",
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
