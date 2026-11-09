import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the unpacked Chrome extension into build/ (zipped by CI). public/
// (manifest.json, js/ content scripts, logo/) is copied verbatim; the popup
// bundle keeps the static/js + static/css layout of the former CRA build.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "build",
    assetsDir: "static",
    rolldownOptions: {
      input: { main: "index.html" },
      output: {
        entryFileNames: "static/js/[name].[hash].js",
        chunkFileNames: "static/js/[name].[hash].js",
        assetFileNames: (asset) =>
          asset.names.some((n) => n.endsWith(".css"))
            ? "static/css/[name].[hash][extname]"
            : "static/media/[name].[hash][extname]",
      },
    },
  },
});
