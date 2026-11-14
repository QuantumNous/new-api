#!/usr/bin/env node
import * as esbuild from 'esbuild'
import { solidPlugin } from 'esbuild-plugin-solid'
import { tanstackRouter } from '@tanstack/router-plugin/esbuild'

const isDev = process.argv.includes('--dev')

const ctx = await esbuild.context({
  entryPoints: ['src/main.tsx'],
  outfile: 'dist/main.js',
  minify: !isDev,
  bundle: true,
  format: 'esm',
  target: ['esnext'],
  sourcemap: true,
  conditions: ['style'],
  plugins: [
    solidPlugin(),
    tanstackRouter({ target: 'solid', autoCodeSplitting: true }),
  ],
})

if (isDev) {
  await ctx.watch()
  const { host, port } = await ctx.serve({ servedir: '.', port: 3005 })
  console.log(`Server running at http://${host || 'localhost'}:${port}`)
} else {
  await ctx.rebuild()
  await ctx.dispose()
}
