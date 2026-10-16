import { tanstackViteConfig } from '@tanstack/vite-config'

export default tanstackViteConfig({
  tsconfigPath: './tsconfig.server-entry.json',
  srcDir: './src/default-entry',
  exclude: ['./src/default-entry/client.tsx'],
  entry: ['./src/default-entry/server.ts'],
  externalDeps: ['@tanstack/react-start/server'],
  outDir: './dist/default-entry',
  cjs: false,
})
