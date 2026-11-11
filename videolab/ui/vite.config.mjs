import { defineConfig } from "vite";

// VideoLab UI. Built into videolab/ui/dist and served by videolab/server/server.mjs on :3037.
// It imports compositions straight from the repo's src/ and plays them with @remotion/player,
// so Remotion Studio itself stays untouched.
export default defineConfig({
  root: import.meta.dirname,
  base: "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Keep build assets away from /public (Remotion static files) and /api.
    assetsDir: "_videolab",
    chunkSizeWarningLimit: 4000,
    rolldownOptions: {
      // @remotion/player starts with "use client" (a Next.js hint); meaningless here.
      onwarn(warning, defaultHandler) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        defaultHandler(warning);
      },
    },
  },
  server: {
    port: 3038,
    proxy: {
      "/api": "http://127.0.0.1:3037",
      "/public": "http://127.0.0.1:3037",
      "/files": "http://127.0.0.1:3037",
      "/project-files": "http://127.0.0.1:3037",
    },
  },
});
