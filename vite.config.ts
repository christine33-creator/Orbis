import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `SINGLE_FILE=1 npm run build` inlines everything into one index.html (handy for sharing a preview).
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(process.env.SINGLE_FILE ? [viteSingleFile()] : [])],
  build: { chunkSizeWarningLimit: 1200 },
  // The Supabase–Vercel integration names its public variables NEXT_PUBLIC_*; expose those too.
  // Never add a prefix that would match server secrets such as SUPABASE_SERVICE_ROLE_KEY.
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
});
