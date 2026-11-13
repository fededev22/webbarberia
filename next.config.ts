import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Las reservas leen y escriben en cada request. El caché estático las congelaría.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
