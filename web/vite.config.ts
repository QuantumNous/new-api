import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vite.dev/config/
export default defineConfig((config) => {
  const env = loadEnv(config.mode, process.cwd())
  const serverUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.VITE_REACT_APP_SERVER_URL ||
    'http://localhost:3000'

  const isProd = config.mode === 'production'

  return {
    plugins: [
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: serverUrl,
          changeOrigin: true,
        },
        '/mj': {
          target: serverUrl,
          changeOrigin: true,
        },
        '/pg': {
          target: serverUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      // 生产环境移除 console 和 debugger
      minify: 'esbuild',
      target: 'esnext',
      rollupOptions: {
        output: {
          // 优化代码分割
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react-dom') || id.includes('/react/')) {
                return 'vendor-react'
              }
              if (id.includes('@radix-ui')) {
                return 'vendor-radix'
              }
              if (id.includes('@tanstack')) {
                return 'vendor-tanstack'
              }
            }
          },
        },
      },
    },
    esbuild: {
      // 生产环境移除 console 和 debugger
      drop: isProd ? ['console', 'debugger'] : [],
    },
  }
})
