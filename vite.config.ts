import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      target: "es2022",
      cssCodeSplit: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/pixi.js")) {
              return "pixi"
            }
            if (
              id.includes("node_modules/react") ||
              id.includes("node_modules/react-dom") ||
              id.includes("node_modules/gsap") ||
              id.includes("node_modules/lucide-react") ||
              id.includes("node_modules/i18next")
            ) {
              return "vendor"
            }
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: parseInt(process.env.PORT || "8444"),
      strictPort: false,
    },
    preview: {
      host: "0.0.0.0",
      port: parseInt(process.env.PORT || "8444"),
    },
  }
})
