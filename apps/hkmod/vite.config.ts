import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      'dating-core': path.resolve(__dirname, '../../packages/core/src'),
      'dating-ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
});
