import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  const serverUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    'http://localhost:3000'

  const isProd = envMode === 'production'

  return {
    plugins: [pluginReact()],
    source: {
      entry: {
        index: './src/main.tsx',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    html: {
      template: './index.html',
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
    output: {
      // Production optimizations
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
    },
    performance: {
      chunkSplit: {
        strategy: 'split-by-experience',
        // Custom chunk splitting similar to Vite config
        forceSplitting: {
          'vendor-react': /node_modules[\\/](react|react-dom)[\\/]/,
          'vendor-radix': /node_modules[\\/]@radix-ui[\\/]/,
          'vendor-tanstack': /node_modules[\\/]@tanstack[\\/]/,
        },
      },
      // Remove console in production
      removeConsole: isProd ? ['log'] : false,
    },
    tools: {
      rspack: {
        plugins: [
          tanstackRouter({
            target: 'react',
            autoCodeSplitting: true,
          }),
        ],
      },
    },
  }
})
