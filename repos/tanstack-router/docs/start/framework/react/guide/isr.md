---
id: isr
title: Incremental Static Regeneration (ISR)
---

Incremental Static Regeneration (ISR) allows you to serve statically generated content from a CDN while periodically regenerating it in the background. This gives you the performance benefits of static sites with the freshness of dynamic content.

## How ISR Works in TanStack Start

TanStack Start's approach to ISR is flexible and leverages standard HTTP cache headers that work with any CDN. Unlike framework-specific ISR implementations, this approach gives you full control over caching behavior at both the page and data level.

The core concept is simple:

1. **Static Prerendering**: Pages are generated at build time
2. **CDN Caching**: Cache headers control how long CDNs cache the HTML
3. **Revalidation**: After the cache expires, the next request triggers regeneration
4. **Stale-While-Revalidate**: Serve stale content while fetching fresh data in the background

## Cache Header Strategies

### Time-Based Revalidation

The most common ISR pattern uses the `Cache-Control` header with `max-age` and `s-maxage` directives:

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        routes: ['/blog', '/blog/posts/*'],
        crawlLinks: true,
      },
    }),
  ],
})
```

# Rsbuild

```ts title="rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

export default defineConfig({
  plugins: [
    pluginReact(),
    tanstackStart({
      prerender: {
        routes: ['/blog', '/blog/posts/*'],
        crawlLinks: true,
      },
    }),
  ],
})
```

<!-- ::end:tabs -->

```tsx
// routes/blog/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/blog/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId)
    return { post }
  },
  headers: () => ({
    // Cache at CDN for 1 hour, allow stale content for up to 1 day
    'Cache-Control':
      'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
  }),
})

export default function BlogPost() {
  const { post } = Route.useLoaderData()
  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.content}</div>
    </article>
  )
}
```

### Understanding Cache-Control Directives

- **`public`**: Response can be cached by any cache (CDN, browser, etc.)
- **`max-age=3600`**: Content is fresh for 3600 seconds (1 hour)
- **`s-maxage=3600`**: Overrides max-age for shared caches (CDNs)
- **`stale-while-revalidate=86400`**: Serve stale content while revalidating in background for up to 24 hours
- **`immutable`**: Content never changes (use for hash-based assets)

## ISR with Server Functions

Server functions can also set cache headers for dynamic data endpoints:

```tsx
// routes/api/products/$productId.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/products/$productId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const product = await db.products.findById(params.productId)

        return Response.json(
          { product },
          {
            headers: {
              'Cache-Control':
                'public, max-age=300, stale-while-revalidate=600',
              'CDN-Cache-Control': 'max-age=3600', // Cloudflare-specific
            },
          },
        )
      },
    },
  },
})
```

### Using Middleware for Cache Headers

For API routes, you can use middleware to set cache headers:

```tsx
// routes/api/products/$productId.ts
import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware } from '@tanstack/react-start'

const cacheMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next()

  // Add cache headers to the response
  result.response.headers.set(
    'Cache-Control',
    'public, max-age=3600, stale-while-revalidate=86400',
  )

  return result
})

export const Route = createFileRoute('/api/products/$productId')({
  server: {
    middleware: [cacheMiddleware],
    handlers: {
      GET: async ({ params }) => {
        const product = await db.products.findById(params.productId)
        return Response.json({ product })
      },
    },
  },
})
```

For page routes, it's simpler to use the `headers` property directly:

```tsx
// routes/blog/posts/$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/blog/posts/$postId')({
  loader: async ({ params }) => {
    const post = await fetchPost(params.postId)
    return { post }
  },
  headers: () => ({
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  }),
})
```

## On-Demand Revalidation

While time-based revalidation works well for most cases, you may need to invalidate specific pages immediately (e.g., when content is updated):

```tsx
// routes/api/revalidate.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/revalidate')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { path, secret } = await request.json()

        // Verify secret token
        if (secret !== process.env.REVALIDATE_SECRET) {
          return Response.json({ error: 'Invalid token' }, { status: 401 })
        }

        // Trigger CDN purge via your CDN's API
        await fetch(
          `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${CF_API_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              files: [`https://yoursite.com${path}`],
            }),
          },
        )

        return Response.json({ revalidated: true })
      },
    },
  },
})
```

## CDN-Specific Configuration

### Cloudflare Workers

Cloudflare respects standard `Cache-Control` headers and provides additional control:

```tsx
export const Route = createFileRoute('/products/$id')({
  headers: () => ({
    'Cache-Control': 'public, max-age=3600',
    // Cloudflare-specific header for finer control
    'CDN-Cache-Control': 'max-age=7200',
  }),
})
```

### Netlify

Netlify uses `Cache-Control` headers and also supports `_headers` files:

```plaintext
# public/_headers
/blog/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400

/api/*
  Cache-Control: public, max-age=300
```

### Vercel

When deploying to Vercel, use their Edge Network cache headers:

```tsx
export const Route = createFileRoute('/posts/$id')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  }),
})
```

## Combining ISR with Client-Side Caching

TanStack Router's built-in cache control works alongside CDN caching:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    return fetchPost(params.postId)
  },
  // CDN caching (via headers)
  headers: () => ({
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  }),
  // Client-side caching (via TanStack Router)
  staleTime: 60_000, // Consider data fresh for 60 seconds on client
  gcTime: 5 * 60_000, // Keep in memory for 5 minutes
})
```

This creates a multi-tier caching strategy:

1. **CDN Edge**: 1 hour cache, stale-while-revalidate for 24 hours
2. **Client**: 60 seconds of fresh data, 5 minutes in memory

## Common ISR Patterns

### Blog Posts

```tsx
export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }) => fetchPost(params.slug),
  headers: () => ({
    // Cache for 1 hour, allow stale for 7 days
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=604800',
  }),
  staleTime: 5 * 60_000, // 5 minutes client-side
})
```

### E-commerce Product Pages

```tsx
export const Route = createFileRoute('/products/$id')({
  loader: async ({ params }) => fetchProduct(params.id),
  headers: () => ({
    // Shorter cache due to inventory changes
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  }),
  staleTime: 30_000, // 30 seconds client-side
})
```

### Marketing Landing Pages

```tsx
export const Route = createFileRoute('/landing/$campaign')({
  loader: async ({ params }) => fetchCampaign(params.campaign),
  headers: () => ({
    // Long cache for stable content
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
  }),
  staleTime: 60 * 60_000, // 1 hour client-side
})
```

### User-Specific Pages

```tsx
export const Route = createFileRoute('/dashboard')({
  loader: async () => fetchUserData(),
  headers: () => ({
    // Private cache, no CDN caching
    'Cache-Control': 'private, max-age=60',
  }),
  staleTime: 30_000,
})
```

## Best Practices

### 1. Start Conservative

Begin with shorter cache times and increase as you understand your content update patterns:

```tsx
// Start here
'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'

// Then move to
'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400'
```

### 2. Use ETags for Validation

ETags help CDNs efficiently revalidate content:

```tsx
import { createMiddleware } from '@tanstack/react-start'
import crypto from 'crypto'

const etagMiddleware = createMiddleware().server(async ({ next }) => {
  const result = await next()

  // Generate ETag from response content
  const etag = crypto
    .createHash('md5')
    .update(JSON.stringify(result.data))
    .digest('hex')

  result.response.headers.set('ETag', `"${etag}"`)

  return result
})
```

### 3. Vary Cache by Query Parameters

When content varies by query params, include them in cache keys:

```tsx
export const Route = createFileRoute('/search')({
  headers: () => ({
    'Cache-Control': 'public, max-age=300',
    Vary: 'Accept, Accept-Encoding',
  }),
})
```

### 4. Monitor Cache Hit Rates

Track CDN performance to optimize cache times:

```tsx
const cacheMonitoringMiddleware = createMiddleware().server(
  async ({ next }) => {
    const result = await next()

    // Log cache status (from CDN headers)
    console.log('Cache Status:', result.response.headers.get('cf-cache-status'))

    return result
  },
)
```

### 5. Combine with Static Prerendering

Prerender at build time for instant first load, then use ISR for updates:

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      prerender: {
        routes: ['/blog', '/blog/posts/*'],
        crawlLinks: true,
      },
    }),
  ],
})
```

# Rsbuild

```ts title="rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

export default defineConfig({
  plugins: [
    pluginReact(),
    tanstackStart({
      prerender: {
        routes: ['/blog', '/blog/posts/*'],
        crawlLinks: true,
      },
    }),
  ],
})
```

<!-- ::end:tabs -->

## Debugging ISR

### Check Cache Headers

Use browser DevTools or curl to inspect cache headers:

```bash
curl -I https://yoursite.com/blog/my-post

# Look for:
# Cache-Control: public, max-age=3600, stale-while-revalidate=86400
# Age: 1234 (time in cache)
# X-Cache: HIT (from CDN)
```

### Test Revalidation

Force cache misses to test regeneration:

```bash
# Cloudflare: Bypass cache
curl -H "Cache-Control: no-cache" https://yoursite.com/page

# Or use CDN-specific cache purge APIs
```

### Monitor Performance

Track key metrics:

- **Cache Hit Rate**: Percentage of requests served from cache
- **Revalidation Time**: Time to regenerate stale content
- **Time to First Byte (TTFB)**: Should be low for cached content

## Related Resources

- [Static Prerendering](./static-prerendering.md) - Build-time page generation
- [Hosting](./hosting.md) - CDN deployment configurations
- [Server Functions](./server-functions.md) - Creating dynamic data endpoints
- [Data Loading](../../../../router/guide/data-loading.md) - Client-side cache control
- [Middleware](./middleware.md) - Request/response customization
