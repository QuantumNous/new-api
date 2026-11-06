import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import { tanstackStart } from '@tanstack/solid-start/plugin/vite'

export default defineConfig({
  plugins: [tanstackStart(), solid({ ssr: true })],
})
