import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `SINGLE_FILE=1 npm run build` inlines everything into one index.html (handy for sharing a preview).
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(process.env.SINGLE_FILE ? [viteSingleFile()] : [])],
  build: { chunkSizeWarningLimit: 1200 },
});
