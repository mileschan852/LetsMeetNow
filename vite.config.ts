import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
      'dating-core': path.resolve(__dirname, './shared/dating-core/core/src'),
      'dating-ui': path.resolve(__dirname, './shared/dating-core/ui/src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    assetsInlineLimit: 0, // Don't inline any assets - always emit as files
  },
  server: {
    port: 3001,
    host: true,
  },
})
