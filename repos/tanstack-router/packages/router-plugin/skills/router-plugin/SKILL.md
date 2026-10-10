---
name: router-plugin
description: >-
  TanStack Router bundler plugin for route generation and automatic
  code splitting. Supports Vite, Webpack, Rspack, and esbuild.
  Configures autoCodeSplitting, routesDirectory, target framework,
  and code split groupings.
type: core
library: tanstack-router
library_version: '1.166.2'
sources:
  - TanStack/router:packages/router-plugin/src
  - TanStack/router:docs/router/routing/file-based-routing.md
  - TanStack/router:docs/router/guide/code-splitting.md
---

# Router Plugin (`@tanstack/router-plugin`)

Bundler plugin that powers TanStack Router's file-based routing and automatic code splitting. Works with Vite, Webpack, Rspack, and esbuild via unplugin.

> **CRITICAL**: The router plugin MUST come before the framework plugin (React, Solid, Vue) in the Vite config. Wrong order causes route generation and code splitting to fail silently.

## Install

```bash
npm install -D @tanstack/router-plugin
```

## Bundler Setup

### Vite (most common)

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    // MUST come before react()
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
})
```

### Webpack

```ts
// webpack.config.js
const { tanstackRouter } = require('@tanstack/router-plugin/webpack')

module.exports = {
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
  ],
}
```

### Rspack

```ts
// rspack.config.js
const { tanstackRouter } = require('@tanstack/router-plugin/rspack')

module.exports = {
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
  ],
}
```

### esbuild

```ts
import { tanstackRouter } from '@tanstack/router-plugin/esbuild'
import esbuild from 'esbuild'

esbuild.build({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
  ],
})
```

## Configuration Options

### Core Options

| Option                  | Type                          | Default                    | Description                                |
| ----------------------- | ----------------------------- | -------------------------- | ------------------------------------------ |
| `target`                | `'react' \| 'solid' \| 'vue'` | `'react'`                  | Target framework                           |
| `routesDirectory`       | `string`                      | `'./src/routes'`           | Directory containing route files           |
| `generatedRouteTree`    | `string`                      | `'./src/routeTree.gen.ts'` | Path for generated route tree              |
| `autoCodeSplitting`     | `boolean`                     | `undefined`                | Enable automatic code splitting            |
| `enableRouteGeneration` | `boolean`                     | `true`                     | Set to `false` to disable route generation |

### File Convention Options

| Option                   | Type                                                    | Default     | Description                          |
| ------------------------ | ------------------------------------------------------- | ----------- | ------------------------------------ |
| `routeFilePrefix`        | `string`                                                | `undefined` | Prefix filter for route files        |
| `routeFileIgnorePrefix`  | `string`                                                | `'-'`       | Prefix to exclude files from routing |
| `routeFileIgnorePattern` | `string`                                                | `undefined` | Pattern to exclude from routing      |
| `indexToken`             | `string \| RegExp \| { regex: string; flags?: string }` | `'index'`   | Token identifying index routes       |
| `routeToken`             | `string \| RegExp \| { regex: string; flags?: string }` | `'route'`   | Token identifying route config files |

### Code Splitting Options

```ts
tanstackRouter({
  target: 'react',
  autoCodeSplitting: true,
  codeSplittingOptions: {
    // Default groupings for all routes
    defaultBehavior: [['component'], ['errorComponent'], ['notFoundComponent']],

    // Per-route custom splitting
    splitBehavior: ({ routeId }) => {
      if (routeId === '/dashboard') {
        // Keep loader and component together for dashboard
        return [['loader', 'component'], ['errorComponent']]
      }
      // Return undefined to use defaultBehavior
    },
  },
})
```

### Output Options

| Option                      | Type                   | Default    | Description                      |
| --------------------------- | ---------------------- | ---------- | -------------------------------- |
| `quoteStyle`                | `'single' \| 'double'` | `'single'` | Quote style in generated code    |
| `semicolons`                | `boolean`              | `false`    | Use semicolons in generated code |
| `disableTypes`              | `boolean`              | `false`    | Disable TypeScript types         |
| `disableLogging`            | `boolean`              | `false`    | Suppress plugin logs             |
| `addExtensions`             | `boolean \| string`    | `false`    | Add file extensions to imports   |
| `enableRouteTreeFormatting` | `boolean`              | `true`     | Format generated route tree      |

### Virtual Route Config

```ts
import { routes } from './routes'

tanstackRouter({
  target: 'react',
  virtualRouteConfig: routes, // or './routes.ts'
})
```

## How It Works

The composed plugin assembles up to 3 sub-plugins:

1. **Route Generator** (always) — Watches route files and generates `routeTree.gen.ts`
2. **Code Splitter** (when `autoCodeSplitting: true`) — Splits route files into lazy-loaded chunks using virtual modules
3. **HMR** (dev mode, when code splitter is off) — Hot-reloads route changes without full refresh

## Individual Plugin Exports

For advanced use, each sub-plugin is exported separately from the Vite entry:

```ts
import {
  tanstackRouter, // Composed (default)
  tanstackRouterGenerator, // Generator only
  tanStackRouterCodeSplitter, // Code splitter only
} from '@tanstack/router-plugin/vite'
```

## Common Mistakes

### 1. CRITICAL: Wrong plugin order in Vite config

The router plugin must come before the framework plugin. Otherwise, route generation and code splitting fail silently.

```ts
// WRONG — react() before tanstackRouter()
plugins: [react(), tanstackRouter({ target: 'react' })]

// CORRECT — tanstackRouter() first
plugins: [tanstackRouter({ target: 'react' }), react()]
```

### 2. HIGH: Missing target option for non-React frameworks

The `target` defaults to `'react'`. For Solid or Vue, you must set it explicitly.

```ts
// WRONG for Solid — generates React imports
tanstackRouter({ autoCodeSplitting: true })

// CORRECT for Solid
tanstackRouter({ target: 'solid', autoCodeSplitting: true })
```

### 3. MEDIUM: Confusing autoCodeSplitting with manual lazy routes

When `autoCodeSplitting` is enabled, the plugin handles splitting automatically. You do NOT need manual `createLazyRoute` or `lazyRouteComponent` calls — the plugin transforms your route files at build time.

```tsx
// WRONG — manual lazy loading with autoCodeSplitting enabled
const LazyAbout = lazyRouteComponent(() => import('./about'))

// CORRECT — just write normal route files, plugin handles splitting
// src/routes/about.tsx
export const Route = createFileRoute('/about')({
  component: AboutPage,
})

function AboutPage() {
  return <h1>About</h1>
}
```

## Cross-References

- [router-core/code-splitting](../../../router-core/skills/router-core/code-splitting/SKILL.md) — manual code splitting concepts
- [virtual-file-routes](../../../virtual-file-routes/skills/virtual-file-routes/SKILL.md) — programmatic route trees
