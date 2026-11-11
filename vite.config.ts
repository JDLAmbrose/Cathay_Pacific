import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { PAGE_FILES } from "./src/config/routes.ts";

const backend = process.env.PLUME_API_ORIGIN || "http://127.0.0.1:8000";
const proxy = { "/api": { target: backend, changeOrigin: false } };

export default defineConfig({
  base: process.env.PLUME_BASE_PATH || "/",
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor", test: /[\\/]node_modules[\\/]/ },
            { name: "translations", test: /[\\/]config[\\/]copy\.json$/ },
          ],
        },
      },
      input: Object.values(PAGE_FILES)
        .concat("pages/index.html")
        .map((file) => resolve(file)),
    },
  },
});
