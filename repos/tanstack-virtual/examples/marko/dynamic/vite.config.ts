import { defineConfig } from 'vite'
import marko from '@marko/run/vite'

export default defineConfig({
  // Cast to any: @marko/run/vite types are built against Vite 6 but this
  // workspace uses Vite 5. The plugin works correctly at runtime.
  plugins: [marko() as any],
})
