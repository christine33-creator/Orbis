import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// The app is served under /app/; the marketing site (site/) is the root of the deployment.
// `SINGLE_FILE=1 npm run build` inlines everything into one index.html (handy for sharing a preview).
const single = !!process.env.SINGLE_FILE;
export default defineConfig({
  base: single ? "./" : "/app/",
  plugins: [react(), tailwindcss(), ...(single ? [viteSingleFile()] : [])],
  build: { chunkSizeWarningLimit: 1200, outDir: single ? "dist-single" : "dist/app", emptyOutDir: true },
  // The Supabase–Vercel integration names its public variables NEXT_PUBLIC_*; expose those too.
  // Never add a prefix that would match server secrets such as SUPABASE_SERVICE_ROLE_KEY.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
});
