/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep `next dev` and `next build` from writing into the same directory.
  // Otherwise, running a production build while the dev server is open can
  // leave webpack pointing at chunks that the other process replaced.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next"
};

export default nextConfig;
