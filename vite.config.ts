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
