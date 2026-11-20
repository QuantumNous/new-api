---
title: How to Set Up Server-Side Rendering (SSR)
---

> [!IMPORTANT]
> **[TanStack Start](/start/latest/docs/framework/react/overview) is the recommended way to set up SSR** - it provides SSR, streaming, and deployment with zero configuration.

> Use the manual setup below only if you need to integrate with an existing server.

## Quick Start with TanStack Start

```bash
npx create-tsrouter-app@latest my-app --template start
cd my-app
npm run dev
```

## Manual SSR Setup

### 1. Install Dependencies

```bash
npm install express compression
npm install --save-dev @types/express
```

### 2. Create Shared Router Configuration

```tsx
// src/router.tsx
import { createRouter as createTanstackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function createRouter() {
  return createTanstackRouter({
    routeTree,
    context: {
      head: '', // For server-side head injection
    },
    defaultPreload: 'intent',
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
```

### 3. Set Up Server Entry Point

```tsx
// src/entry-server.tsx
import { pipeline } from 'node:stream/promises'
import {
  RouterServer,
  createRequestHandler,
  renderRouterToString,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'
import type express from 'express'

export async function render({
  req,
  res,
  head = '',
}: {
  head?: string
  req: express.Request
  res: express.Response
}) {
  // Convert Express request to Web API Request
  const url = new URL(req.originalUrl || req.url, 'https://localhost:3000').href

  const request = new Request(url, {
    method: req.method,
    headers: (() => {
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        headers.set(key, value as any)
      }
      return headers
    })(),
  })

  // Create request handler
  const handler = createRequestHandler({
    request,
    createRouter: () => {
      const router = createRouter()

      // Inject server context (like head tags from Vite)
      router.update({
        context: {
          ...router.options.context,
          head: head,
        },
      })
      return router
    },
  })

  // Render to string (non-streaming)
  const response = await handler(({ responseHeaders, router }) =>
    renderRouterToString({
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    }),
  )

  // Convert Web API Response back to Express response
  res.statusMessage = response.statusText
  res.status(response.status)

  response.headers.forEach((value, name) => {
    res.setHeader(name, value)
  })

  // Stream response body
  return pipeline(response.body as any, res)
}
```

### 4. Set Up Client Entry Point

```tsx
// src/entry-client.tsx
import { hydrateRoot } from 'react-dom/client'
import { RouterClient } from '@tanstack/react-router/ssr/client'
import { createRouter } from './router'

const router = createRouter()

hydrateRoot(document, <RouterClient router={router} />)
```

### 5. Configure Vite for SSR

```ts
// vite.config.ts
import path from 'node:path'
import url from 'node:url'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
    }),
    react(),
  ],
  build: isSsrBuild
    ? {
        // SSR build configuration
        ssr: true,
        outDir: 'dist/server',
        emitAssets: true,
        copyPublicDir: false,
        rolldownOptions: {
          input: path.resolve(__dirname, 'src/entry-server.tsx'),
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash][extname]',
          },
        },
      }
    : {
        // Client build configuration
        outDir: 'dist/client',
        emitAssets: true,
        copyPublicDir: true,
        rolldownOptions: {
          input: path.resolve(__dirname, 'src/entry-client.tsx'),
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: 'assets/[name]-[hash].js',
            assetFileNames: 'assets/[name]-[hash][extname]',
          },
        },
      },
}))
```

### 6. Update Root Route for HTML Structure

```tsx
// src/routes/__root.tsx
import {
  HeadContent,
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

interface RouterContext {
  head: string
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
      { rel: 'manifest', href: '/manifest.json' },
    ],
    meta: [
      {
        charSet: 'UTF-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0',
      },
      {
        title: 'TanStack Router SSR App',
      },
    ],
    scripts: [
      // Development scripts
      ...(!import.meta.env.PROD
        ? [
            {
              type: 'module',
              children: `import RefreshRuntime from "/@react-refresh"
                RefreshRuntime.injectIntoGlobalHook(window)
                window.$RefreshReg$ = () => {}
                window.$RefreshSig$ = () => (type) => type
                window.__vite_plugin_react_preamble_installed__ = true`,
            },
            {
              type: 'module',
              src: '/@vite/client',
            },
          ]
        : []),
      // Entry script
      {
        type: 'module',
        src: import.meta.env.PROD
          ? '/entry-client.js'
          : '/src/entry-client.tsx',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <TanStackRouterDevtools />
      </body>
    </html>
  )
}
```

### 7. Create Express Server

```js
// server.js
import path from 'node:path'
import express from 'express'
import compression from 'compression'

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITE_TEST_BUILD

export async function createServer(
  root = process.cwd(),
  isProd = process.env.NODE_ENV === 'production',
  hmrPort = process.env.VITE_DEV_SERVER_PORT,
) {
  const app = express()

  let vite
  if (!isProd) {
    // Development mode with Vite middleware
    vite = await (
      await import('vite')
    ).createServer({
      root,
      logLevel: isTest ? 'error' : 'info',
      server: {
        middlewareMode: true,
        watch: {
          usePolling: true,
          interval: 100,
        },
        hmr: {
          port: hmrPort,
        },
      },
      appType: 'custom',
    })
    app.use(vite.middlewares)
  } else {
    // Production mode
    app.use(compression())
    app.use(express.static('./dist/client'))
  }

  app.use('*', async (req, res) => {
    try {
      const url = req.originalUrl

      // Check for static assets
      if (path.extname(url) !== '') {
        console.warn(`${url} is not a valid router path`)
        res.status(404).end(`${url} is not a valid router path`)
        return
      }

      // Extract head content from Vite in development
      let viteHead = ''
      if (!isProd) {
        const transformedHtml = await vite.transformIndexHtml(
          url,
          `<html><head></head><body></body></html>`,
        )
        viteHead = transformedHtml.substring(
          transformedHtml.indexOf('<head>') + 6,
          transformedHtml.indexOf('</head>'),
        )
      }

      // Load server entry
      const entry = await (async () => {
        if (!isProd) {
          return vite.ssrLoadModule('/src/entry-server.tsx')
        } else {
          return import('./dist/server/entry-server.js')
        }
      })()

      console.info('Rendering:', url)
      await entry.render({ req, res, head: viteHead })
    } catch (e) {
      !isProd && vite.ssrFixStacktrace(e)
      console.error(e.stack)
      res.status(500).end(e.stack)
    }
  })

  return { app, vite }
}

if (!isTest) {
  createServer().then(({ app }) =>
    app.listen(3000, () => {
      console.info('Server running at http://localhost:3000')
    }),
  )
}
```

### 8. Update Package Scripts

```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "npm run build:client && npm run build:server",
    "build:client": "vite build",
    "build:server": "vite build --ssr",
    "start": "NODE_ENV=production node server.js"
  }
}
```

## Streaming SSR

For better performance, enable streaming SSR by replacing `renderRouterToString` with `renderRouterToStream`:

```tsx
// src/entry-server.tsx
import { renderRouterToStream } from '@tanstack/react-router/ssr/server'

// Replace renderRouterToString with:
const response = await handler(({ request, responseHeaders, router }) =>
  renderRouterToStream({
    request,
    responseHeaders,
    router,
    children: <RouterServer router={router} />,
  }),
)
```

### Streaming Vite Configuration

For streaming SSR, update your Vite config:

```ts
// vite.config.ts
export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      enableStreaming: true, // Enable streaming support
    }),
    react(),
  ],
  // ... rest of config
  ssr: {
    optimizeDeps: {
      include: ['@tanstack/react-router/ssr/server'],
    },
  },
}))
```

## Common Problems

> [!TIP]
> **Most of these problems are automatically solved by [TanStack Start](/start/latest/docs/framework/react/overview).** The issues below are primarily relevant for manual SSR setups.

### React Import Errors

**Problem:** `ReferenceError: React is not defined` during SSR

**Solution:** Ensure React is properly imported in components:

```tsx
// In your route components
import React from 'react' // Add explicit import
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <div>Hello World</div>, // React is now available
})
```

### Hydration Mismatches

**Problem:** Client HTML doesn't match server HTML

**Solution:** Ensure consistent rendering between server and client:

```tsx
// Use useIsomorphicLayoutEffect for browser-only effects
import { useLayoutEffect, useEffect } from 'react'

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

function MyComponent() {
  useIsomorphicLayoutEffect(() => {
    // Browser-only code that won't cause hydration mismatches
  }, [])
}
```

### Bun Runtime Issues

**Problem:** `Cannot find module "react-dom/server"` with Bun

**Solution:** Use Node.js compatibility or create Bun-specific builds:

```json
{
  "scripts": {
    "build:bun": "bun build --target=bun --outdir=dist/bun src/entry-server.tsx"
  }
}
```

### Module Resolution Errors

**Problem:** SSR modules not resolving correctly

**Solution:** Configure Vite SSR externals:

```ts
// vite.config.ts
export default defineConfig({
  ssr: {
    noExternal: [
      // Packages that need to be bundled for SSR
      '@tanstack/react-router',
    ],
    external: [
      // Packages that should remain external
      'express',
    ],
  },
})
```

### Streaming Configuration Issues

**Problem:** Streaming SSR not working with existing Vite setup

**Solution:** Ensure proper streaming configuration:

```ts
// vite.config.ts - Additional streaming config
export default defineConfig({
  define: {
    'process.env.STREAMING_SSR': JSON.stringify(true),
  },
  optimizeDeps: {
    include: ['@tanstack/react-router/ssr/server'],
  },
})
```

### Build Output Issues

**Problem:** Server build missing assets or incorrect paths

**Solution:** Verify build configuration:

```ts
// vite.config.ts
const ssrConfig = {
  ssr: true,
  outDir: 'dist/server',
  ssrEmitAssets: true, // Important for asset handling
  copyPublicDir: false,
  rolldownOptions: {
    input: path.resolve(__dirname, 'src/entry-server.tsx'),
    external: ['express', 'compression'], // External deps
  },
}
```

## Related Resources

- [TanStack Start](/start/latest/docs/framework/react/overview) - **Recommended full-stack React framework with SSR**
- [SSR Guide (Detailed)](../guide/ssr.md) - Comprehensive SSR concepts, utilities, and theory
- [Data Loading](../guide/data-loading.md) - SSR-compatible data loading patterns

## Common Next Steps

- [Deploy to Production](./deploy-to-production.md) - Deploy your SSR app
- [Setup Authentication](./setup-authentication.md) - Add auth to SSR routes
- [Debug Router Issues](./debug-router-issues.md) - Troubleshoot SSR-specific routing problems

<!-- TODO: Uncomment as guides are created
- [Fix Build Issues](./fix-build-issues.md) - Troubleshoot bundler problems
-->
