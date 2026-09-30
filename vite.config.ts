import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    react(),

    viteStaticCopy({
      targets: [
        {
          src: "manifest.json",
          dest: "."
        },
        {
          src: "src/wasm/*",
          dest: "wasm",
          rename: {
            stripBase: 2
          }
        }
      ]
    })
  ],

  optimizeDeps: {
    include: ["gun"]
  },

  build: {
    minify: false,

    commonjsOptions: {
      include: [/node_modules\/gun/, /node_modules/],
      transformMixedEsModules: true
    },

    outDir: "dist",

    rollupOptions: {
      treeshake: false,

      input: {
        content: "src/content.tsx",
        background: "src/background.js"
      },

      output: {
        entryFileNames: "[name].js"
      }
    }
  }
});