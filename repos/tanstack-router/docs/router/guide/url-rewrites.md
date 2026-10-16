---
title: URL Rewrites
---

URL rewrites allow you to transform URLs bidirectionally between what the browser displays and what the router interprets internally. This powerful feature enables patterns like locale prefixes, subdomain routing, legacy URL migration, and multi-tenant applications without duplicating routes or complicating your route tree.

## When to Use URL Rewrites

URL rewrites are useful when you need to:

- **i18n locale prefixes**: Display `/en/about` in the browser but route to `/about` internally
- **Subdomain routing**: Route `admin.example.com/users` to `/admin/users` internally
- **Legacy URL migration**: Support old URLs like `/old-path` that map to new routes
- **Multi-tenant applications**: Route `tenant1.example.com` to tenant-specific routes
- **Custom URL schemes**: Transform any URL pattern to match your route structure

## How URL Rewrites Work

URL rewrites operate in two directions:

1. **Input rewrite**: Transforms the URL **from the browser** before the router interprets it
2. **Output rewrite**: Transforms the URL **from the router** before it's written to the browser

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser URL Bar                         │
│                        /en/about?q=test                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼ input rewrite
┌─────────────────────────────────────────────────────────────────┐
│                      Router Internal URL                        │
│                        /about?q=test                            │
│                                                                 │
│                    (matches routes, runs loaders)               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼ output rewrite
┌─────────────────────────────────────────────────────────────────┐
│                         Browser URL Bar                         │
│                        /en/about?q=test                         │
└─────────────────────────────────────────────────────────────────┘
```

The router exposes two href properties on the location object:

- `location.href` - The internal URL (after input rewrite)
- `location.publicHref` - The external URL displayed in the browser (after output rewrite)

## Basic Usage

Configure rewrites when creating your router:

```tsx
import { createRouter } from '@tanstack/react-router'

const router = createRouter({
  routeTree,
  rewrite: {
    input: ({ url }) => {
      // Transform browser URL → router internal URL
      // Return the modified URL, a new URL, or undefined to skip
      return url
    },
    output: ({ url }) => {
      // Transform router internal URL → browser URL
      // Return the modified URL, a new URL, or undefined to skip
      return url
    },
  },
})
```

The `input` and `output` functions receive a `URL` object and can:

- Mutate and return the same `url` object
- Return a new `URL` instance
- Return a full href string (will be parsed into a URL)
- Return `undefined` to skip the rewrite

## Common Patterns

### Pattern 1: i18n Locale Prefix

Strip locale prefixes on input and add them back on output:

```tsx
const locales = ['en', 'fr', 'es', 'de']
const defaultLocale = 'en'

// Get current locale (from cookie, localStorage, or detection)
function getLocale() {
  return localStorage.getItem('locale') || defaultLocale
}

const router = createRouter({
  routeTree,
  rewrite: {
    input: ({ url }) => {
      // Check if pathname starts with a locale prefix
      const segments = url.pathname.split('/').filter(Boolean)
      const firstSegment = segments[0]

      if (firstSegment && locales.includes(firstSegment)) {
        // Strip the locale prefix: /en/about → /about
        url.pathname = '/' + segments.slice(1).join('/') || '/'
      }
      return url
    },
    output: ({ url }) => {
      const locale = getLocale()
      // Add locale prefix: /about → /en/about
      if (locale !== defaultLocale || true) {
        // Always prefix, or conditionally skip default locale
        url.pathname = `/${locale}${url.pathname === '/' ? '' : url.pathname}`
      }
      return url
    },
  },
})
```

For production i18n, consider using a library like Paraglide that provides `localizeUrl` and `deLocalizeUrl` functions. See the [Internationalization guide](./internationalization-i18n.md) for integration details.

### Pattern 2: Subdomain to Path Routing

Route subdomain requests to path-based routes:

```tsx
const router = createRouter({
  routeTree,
  rewrite: {
    input: ({ url }) => {
      const subdomain = url.hostname.split('.')[0]

      // admin.example.com/users → /admin/users
      if (subdomain === 'admin') {
        url.pathname = '/admin' + url.pathname
      }
      // api.example.com/v1/users → /api/v1/users
      else if (subdomain === 'api') {
        url.pathname = '/api' + url.pathname
      }

      return url
    },
    output: ({ url }) => {
      // Reverse the transformation for link generation
      if (url.pathname.startsWith('/admin')) {
        url.hostname = 'admin.example.com'
        url.pathname = url.pathname.replace(/^\/admin/, '') || '/'
      } else if (url.pathname.startsWith('/api')) {
        url.hostname = 'api.example.com'
        url.pathname = url.pathname.replace(/^\/api/, '') || '/'
      }
      return url
    },
  },
})
```

### Pattern 3: Legacy URL Migration

Support old URLs while maintaining new route structure:

```tsx
const legacyPaths: Record<string, string> = {
  '/old-about': '/about',
  '/old-contact': '/contact',
  '/blog-posts': '/blog',
  '/user-profile': '/account/profile',
}

const router = createRouter({
  routeTree,
  rewrite: {
    input: ({ url }) => {
      const newPath = legacyPaths[url.pathname]
      if (newPath) {
        url.pathname = newPath
      }
      return url
    },
    // No output rewrite needed - new URLs will be used going forward
  },
})
```

### Pattern 4: Multi-tenant Routing

Route tenant-specific domains to a unified route structure:

```tsx
const router = createRouter({
  routeTree,
  rewrite: {
    input: ({ url }) => {
      // Extract tenant from subdomain: acme.app.com → acme
      const parts = url.hostname.split('.')
      if (parts.length >= 3) {
        const tenant = parts[0]
        // Inject tenant into the path: /dashboard → /tenant/acme/dashboard
        url.pathname = `/tenant/${tenant}${url.pathname}`
      }
      return url
    },
    output: ({ url }) => {
      // Extract tenant from path and move to subdomain
      const match = url.pathname.match(/^\/tenant\/([^/]+)(.*)$/)
      if (match) {
        const [, tenant, rest] = match
        url.hostname = `${tenant}.app.com`
        url.pathname = rest || '/'
      }
      return url
    },
  },
})
```

### Pattern 5: Search Parameter Transformation

Transform search parameters during rewrites:

```tsx
const router = createRouter({
  routeTree,
  rewrite: {
    input: ({ url }) => {
      // Convert legacy search param format
      // ?filter_status=active → ?status=active
      const filterStatus = url.searchParams.get('filter_status')
      if (filterStatus) {
        url.searchParams.delete('filter_status')
        url.searchParams.set('status', filterStatus)
      }
      return url
    },
    output: ({ url }) => {
      // Optionally transform back for external display
      return url
    },
  },
})
```

## Composing Multiple Rewrites

When you need multiple independent rewrite transformations, use `composeRewrites` to combine them:

```tsx
import { composeRewrites } from '@tanstack/react-router'

const localeRewrite = {
  input: ({ url }) => {
    // Strip locale prefix
    const match = url.pathname.match(/^\/(en|fr|es)(\/.*)$/)
    if (match) {
      url.pathname = match[2] || '/'
    }
    return url
  },
  output: ({ url }) => {
    // Add locale prefix
    url.pathname = `/en${url.pathname === '/' ? '' : url.pathname}`
    return url
  },
}

const legacyRewrite = {
  input: ({ url }) => {
    if (url.pathname === '/old-page') {
      url.pathname = '/new-page'
    }
    return url
  },
}

const router = createRouter({
  routeTree,
  rewrite: composeRewrites([localeRewrite, legacyRewrite]),
})
```

**Order of operations:**

- **Input rewrites**: Execute in order (first to last)
- **Output rewrites**: Execute in reverse order (last to first)

This ensures that composed rewrites "unwrap" correctly. In the example above:

- Input: locale strips `/en`, then legacy redirects `/old-page`
- Output: legacy runs first (no-op), then locale adds `/en` back

## Interaction with Basepath

When you configure a `basepath`, the router internally implements it as a rewrite. If you also provide a custom `rewrite`, they are automatically composed together:

```tsx
const router = createRouter({
  routeTree,
  basepath: '/app',
  rewrite: {
    input: ({ url }) => {
      // This runs AFTER basepath is stripped
      // Browser: /app/en/about → After basepath: /en/about → Your rewrite: /about
      return url
    },
    output: ({ url }) => {
      // This runs BEFORE basepath is added
      // Your rewrite: /about → After your rewrite: /en/about → Basepath adds: /app/en/about
      return url
    },
  },
})
```

The composition order ensures:

1. **Input**: Basepath stripped first, then your rewrite runs
2. **Output**: Your rewrite runs first, then basepath added

## Working with Links and Navigation

### Link Component

The `<Link>` component automatically applies output rewrites when generating `href` attributes:

```tsx
// With locale rewrite configured (adds /en prefix)
<Link to="/about">About</Link>
// Renders: <a href="/en/about">About</a>
```

### Programmatic Navigation

Programmatic navigation via `navigate()` or `router.navigate()` also respects rewrites:

```tsx
const navigate = useNavigate()

// Navigates to /about internally, displays /en/about in browser
navigate({ to: '/about' })
```

### Hard Links for Cross-Origin Rewrites

When an output rewrite changes the origin (hostname), the `<Link>` component automatically renders a standard anchor tag instead of using client-side navigation:

```tsx
// Rewrite that changes hostname for /admin paths
const router = createRouter({
  routeTree,
  rewrite: {
    output: ({ url }) => {
      if (url.pathname.startsWith('/admin')) {
        url.hostname = 'admin.example.com'
        url.pathname = url.pathname.replace(/^\/admin/, '') || '/'
      }
      return url
    },
  },
})

// This link will be a hard navigation (full page load)
<Link to="/admin/dashboard">Admin Dashboard</Link>
// Renders: <a href="https://admin.example.com/dashboard">Admin Dashboard</a>
```

## The publicHref Property

The router's location object includes a `publicHref` property that contains the external URL (after output rewrite):

```tsx
function MyComponent() {
  const location = useLocation()

  // Internal URL used for routing
  console.log(location.href) // "/about"

  // External URL shown in browser
  console.log(location.publicHref) // "/en/about"

  return (
    <div>
      {/* Use publicHref for sharing, canonical URLs, etc. */}
      <ShareButton url={window.location.origin + location.publicHref} />
    </div>
  )
}
```

Use `publicHref` when you need the actual browser URL for:

- Social sharing
- Canonical URLs
- Analytics tracking
- Copying links to clipboard

## Server-side Considerations

URL rewrites apply on both client and server. When using TanStack Start:

### Server Middleware

Rewrites are applied when parsing incoming requests:

```tsx
// router.tsx
export const router = createRouter({
  routeTree,
  rewrite: {
    input: ({ url }) => deLocalizeUrl(url),
    output: ({ url }) => localizeUrl(url),
  },
})
```

The server handler will use the same rewrite configuration to parse incoming URLs and generate responses with the correct external URLs.

### SSR Hydration

The router ensures that the server-rendered HTML and client hydration use consistent URLs. The `publicHref` is serialized during SSR so the client can hydrate with the correct external URL.

## API Reference

### `rewrite` option

- Type: [`LocationRewrite`](#locationrewrite-type)
- Optional
- Configures bidirectional URL transformation between browser and router.

### LocationRewrite type

```tsx
type LocationRewrite = {
  /**
   * Transform the URL before the router interprets it.
   * Called when reading from browser history.
   */
  input?: LocationRewriteFunction

  /**
   * Transform the URL before it's written to browser history.
   * Called when generating links and committing navigation.
   */
  output?: LocationRewriteFunction
}
```

### LocationRewriteFunction type

```tsx
type LocationRewriteFunction = (opts: { url: URL }) => undefined | string | URL
```

**Parameters:**

- `url`: A `URL` object representing the current URL

**Returns:**

- `URL`: The transformed URL object (can be the same mutated object or a new instance)
- `string`: A full href string that will be parsed into a URL
- `undefined`: Skip the rewrite, use the original URL

### composeRewrites function

```tsx
import { composeRewrites } from '@tanstack/react-router'

function composeRewrites(rewrites: Array<LocationRewrite>): LocationRewrite
```

Combines multiple rewrite pairs into a single rewrite. Input rewrites execute in order, output rewrites execute in reverse order.

**Example:**

```tsx
const composedRewrite = composeRewrites([
  { input: rewrite1Input, output: rewrite1Output },
  { input: rewrite2Input, output: rewrite2Output },
])

// Input execution order: rewrite1Input → rewrite2Input
// Output execution order: rewrite2Output → rewrite1Output
```

## Examples

Complete working examples are available in the TanStack Router repository:

- [React + Paraglide (Client-side i18n)](https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide)
- [React + TanStack Start + Paraglide (SSR i18n)](https://github.com/TanStack/router/tree/main/examples/react/start-i18n-paraglide)
- [Solid + Paraglide (Client-side i18n)](https://github.com/TanStack/router/tree/main/examples/solid/i18n-paraglide)
- [Solid + TanStack Start + Paraglide (SSR i18n)](https://github.com/TanStack/router/tree/main/examples/solid/start-i18n-paraglide)
