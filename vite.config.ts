import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'node:fs'
import { resolveWebsiteExtensionId } from './server/services/extensionIdentity'
import { normalizeRepository } from './server/contracts/extensionRelease'
import { EXTENSION_VERSION } from './extension/src/manifest'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'))
  const packageRepository = typeof packageJson.repository === 'object' ? packageJson.repository?.url : packageJson.repository
  const repository = normalizeRepository(env.TALVYN_GITHUB_REPOSITORY || packageRepository)
  if (!repository) throw new Error('Configure the actual GitHub repository in package.json.repository or TALVYN_GITHUB_REPOSITORY.')
  return {
  define: {
    'import.meta.env.VITE_TALVYN_EXTENSION_ID': JSON.stringify(resolveWebsiteExtensionId(mode, env)),
    'import.meta.env.VITE_TALVYN_GITHUB_REPOSITORY': JSON.stringify(repository),
    'import.meta.env.VITE_TALVYN_LOCAL_EXTENSION_VERSION': JSON.stringify(EXTENSION_VERSION),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
      },
    },
  },
  }
})
