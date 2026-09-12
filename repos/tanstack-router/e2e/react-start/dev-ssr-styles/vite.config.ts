import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { ssrStylesMode, useNitro, viteBundledDev } from './env'

function getSsrStylesConfig() {
  switch (ssrStylesMode) {
    case 'disabled':
      return { enabled: false }
    case 'custom-basepath':
      return { enabled: true, basepath: '/custom-styles/' }
    case 'default':
      return {} // use defaults (enabled=true, basepath=vite base)
  }
}

export default defineConfig(async () => {
  // Dynamically import nitro only when needed to avoid loading it when not used
  const nitroPlugin = useNitro ? [(await import('nitro/vite')).nitro()] : []

  return {
    resolve: { tsconfigPaths: true },
    experimental: viteBundledDev ? { bundledDev: true } : undefined,
    server: {
      port: 3000,
    },
    plugins: [
      // Nitro is placed BEFORE tanstackStart to test that our CSS middleware
      // works regardless of plugin order (nitro has a catch-all middleware)
      ...nitroPlugin,
      tanstackStart({
        dev: {
          ssrStyles: getSsrStylesConfig(),
        },
      }),
      viteReact(),
    ],
  }
})
