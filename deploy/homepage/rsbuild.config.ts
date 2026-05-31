import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const serverUrl =
  process.env.API_SERVER_URL || 'http://localhost:3000'

export default defineConfig(({ envMode }) => {
  const isProd = envMode === 'production'

  return {
    plugins: [pluginReact()],
    root: __dirname,
    source: {
      entry: { index: path.resolve(__dirname, 'src/main.tsx') },
    },
    html: { template: path.resolve(__dirname, 'index.html') },
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': { target: serverUrl, changeOrigin: true },
        '/v1': { target: serverUrl, changeOrigin: true },
        '/docs': { target: 'https://llm-api.vynexcloud.com', changeOrigin: true, secure: true },
        '/sign-in': { target: 'https://llm-api.vynexcloud.com', changeOrigin: true, secure: true },
        '/sign-up': { target: 'https://llm-api.vynexcloud.com', changeOrigin: true, secure: true },
        '/dashboard': { target: 'https://llm-api.vynexcloud.com', changeOrigin: true, secure: true },
        '/playground': { target: 'https://llm-api.vynexcloud.com', changeOrigin: true, secure: true },
        '/pricing': { target: 'https://llm-api.vynexcloud.com', changeOrigin: true, secure: true },
        '/about': { target: 'https://llm-api.vynexcloud.com', changeOrigin: true, secure: true },
        '/assets': { target: 'https://llm-api.vynexcloud.com', changeOrigin: true, secure: true },
      },
    },
    output: {
      minify: isProd,
      target: 'web',
      distPath: { root: 'dist' },
    },
  }
})
