---
name: start-core/deployment
description: >-
  Deploy to Cloudflare Workers, Netlify, Vercel, Node.js/Docker,
  Bun, Railway. Selective SSR (ssr option per route), SPA mode,
  static prerendering, ISR with Cache-Control headers, SEO and
  head management.
type: sub-skill
library: tanstack-start
library_version: '1.166.2'
requires:
  - start-core
sources:
  - TanStack/router:docs/start/framework/react/guide/hosting.md
  - TanStack/router:docs/start/framework/react/guide/selective-ssr.md
  - TanStack/router:docs/start/framework/react/guide/static-prerendering.md
  - TanStack/router:docs/start/framework/react/guide/seo.md
---

# Deployment and Rendering

TanStack Start deploys to any hosting provider via Vite and Nitro. This skill covers hosting setup, SSR configuration, prerendering, and SEO.

## Hosting Providers

### Cloudflare Workers

```bash
pnpm add -D @cloudflare/vite-plugin wrangler
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
})
```

```jsonc
// wrangler.jsonc
{
  "name": "my-app",
  "compatibility_date": "2025-09-02",
  "compatibility_flags": ["nodejs_compat"],
  "main": "@tanstack/react-start/server-entry",
}
```

Deploy: `npx wrangler login && pnpm run deploy`

> **Worker env is per-request.** Cloudflare Workers inject env vars at request time. `process.env.X` at module scope evaluates to `undefined` even on the server. The Cloudflare-canonical way to read env (including from module scope) is the `cloudflare:workers` env binding:
>
> ```ts
> import { env } from 'cloudflare:workers'
> const apiHost = env.API_HOST
> ```
>
> Or read `process.env.X` per-request inside `.handler()` / middleware `.server()`. See [Cloudflare's environment-variables docs](https://developers.cloudflare.com/workers/configuration/environment-variables/) and [start-core/execution-model](../execution-model/SKILL.md).

### Netlify

```bash
pnpm add -D @netlify/vite-plugin-tanstack-start
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tanstackStart(), netlify(), viteReact()],
})
```

Deploy: `npx netlify deploy`

### Nitro (Vercel, Railway, Node.js, Docker)

```bash
npm install nitro@npm:nitro-nightly@latest
```

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { nitro } from 'nitro/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [tanstackStart(), nitro(), viteReact()],
})
```

Build and start: `npm run build && node .output/server/index.mjs`

### Bun

Bun deployment requires React 19. For React 18, use Node.js deployment.

```ts
// vite.config.ts — add bun preset to nitro
plugins: [tanstackStart(), nitro({ preset: 'bun' }), viteReact()]
```

## Selective SSR

Control SSR per route with the `ssr` property.

### `ssr: true` (default)

Runs `beforeLoad` and `loader` on server, renders component on server:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  ssr: true, // default
  loader: () => fetchPost(), // runs on server during SSR
  component: PostPage, // rendered on server
})
```

### `ssr: false`

Disables server execution of `beforeLoad`/`loader` and server rendering:

```tsx
export const Route = createFileRoute('/dashboard')({
  ssr: false,
  loader: () => fetchDashboard(), // runs on client only
  component: DashboardPage, // rendered on client only
})
```

### `ssr: 'data-only'`

Runs `beforeLoad`/`loader` on server but renders component on client only:

```tsx
export const Route = createFileRoute('/canvas')({
  ssr: 'data-only',
  loader: () => fetchCanvasData(), // runs on server
  component: CanvasPage, // rendered on client only
})
```

### Functional Form

Decide SSR at runtime based on params/search:

```tsx
export const Route = createFileRoute('/docs/$docType/$docId')({
  ssr: ({ params }) => {
    if (params.status === 'success' && params.value.docType === 'sheet') {
      return false
    }
  },
})
```

### SSR Inheritance

Children inherit parent SSR config and can only be MORE restrictive:

- `true` → `data-only` or `false` (allowed)
- `false` → `true` (NOT allowed — parent `false` wins)

### Default SSR

Change the default for all routes in `src/start.ts`:

```tsx
import { createStart } from '@tanstack/react-start'

export const startInstance = createStart(() => ({
  defaultSsr: false,
}))
```

## Static Prerendering

Generate static HTML at build time:

```ts
// vite.config.ts
tanstackStart({
  prerender: {
    enabled: true,
    crawlLinks: true,
    concurrency: 14,
    failOnError: true,
  },
})
```

Static routes are auto-discovered. Dynamic routes (e.g. `/users/$userId`) require `crawlLinks` or explicit `pages` config.

## SEO and Head Management

### Basic Meta Tags

```tsx
export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: 'My App - Home' },
      { name: 'description', content: 'Welcome to My App' },
    ],
  }),
})
```

### Dynamic Meta from Loader Data

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => fetchPost(params.postId),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData.title },
      { name: 'description', content: loaderData.excerpt },
      { property: 'og:title', content: loaderData.title },
      { property: 'og:image', content: loaderData.coverImage },
    ],
  }),
})
```

### Structured Data (JSON-LD)

```tsx
head: ({ loaderData }) => ({
  scripts: [
    {
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: loaderData.title,
      }),
    },
  ],
})
```

### Dynamic Sitemap via Server Route

```ts
// src/routes/sitemap[.]xml.ts
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const posts = await fetchAllPosts()
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${posts.map((p) => `<url><loc>https://myapp.com/posts/${p.id}</loc></url>`).join('')}
</urlset>`
        return new Response(sitemap, {
          headers: { 'Content-Type': 'application/xml' },
        })
      },
    },
  },
})
```

## Common Mistakes

### 1. HIGH: Missing nodejs_compat flag for Cloudflare Workers

```jsonc
// WRONG — Node.js APIs fail at runtime
{ "compatibility_flags": [] }

// CORRECT
{ "compatibility_flags": ["nodejs_compat"] }
```

### 2. MEDIUM: Bun deployment with React 18

Bun-specific deployment only works with React 19. Use Node.js deployment for React 18.

### 3. MEDIUM: Child route loosening parent SSR config

```tsx
// Parent sets ssr: false
// WRONG — child cannot upgrade to ssr: true
const parentRoute = createFileRoute('/dashboard')({ ssr: false })
const childRoute = createFileRoute('/dashboard/stats')({
  ssr: true, // IGNORED — parent false wins
})

// CORRECT — children can only be MORE restrictive
const parentRoute = createFileRoute('/dashboard')({ ssr: 'data-only' })
const childRoute = createFileRoute('/dashboard/stats')({
  ssr: false, // OK — more restrictive than parent
})
```

## Cross-References

- [start-core/server-routes](../server-routes/SKILL.md) — API endpoints for sitemaps, robots.txt
- [start-core/execution-model](../execution-model/SKILL.md) — SSR affects where code runs
