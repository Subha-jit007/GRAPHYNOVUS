/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the Gemini SDK as a native Node module — bundling it through webpack
  // triggers browser-incompatible code paths and inflates cold-start size.
  serverExternalPackages: ["@google/generative-ai"],
};

export default nextConfig;
