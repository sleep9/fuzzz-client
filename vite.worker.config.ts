import { defineConfig } from "vite";

export default defineConfig({
  build: {
    minify: false,
    outDir: "dist",
    emptyOutDir: false,

    rollupOptions: {
      input: "src/equix-worker.js",

      output: {
        entryFileNames: "equix-worker.js",
        format: "iife"
      }
    }
  }
});