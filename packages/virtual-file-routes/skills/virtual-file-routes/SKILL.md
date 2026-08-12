---
name: virtual-file-routes
description: >-
  Programmatic route tree building as an alternative to filesystem
  conventions: rootRoute, index, route, layout, physical,
  defineVirtualSubtreeConfig. Use with TanStack Router plugin's
  virtualRouteConfig option.
type: core
library: tanstack-router
library_version: '1.161.4'
sources:
  - TanStack/router:packages/virtual-file-routes/src
  - TanStack/router:docs/router/routing/virtual-file-routes.md
---

# Virtual File Routes (`@tanstack/virtual-file-routes`)

Build route trees programmatically instead of relying on filesystem conventions. Useful when you want explicit control over route structure, need to mix virtual and physical routes, or want to define route subtrees within file-based routing directories.

> **CRITICAL**: Types are FULLY INFERRED. Never cast, never annotate inferred values.

## Install

```bash
npm install @tanstack/virtual-file-routes
```

## API Reference

### `rootRoute(file, children?)`

Creates the root of a virtual route tree.

```ts
import { rootRoute, index, route } from '@tanstack/virtual-file-routes'

const routes = rootRoute('root.tsx', [
  index('index.tsx'),
  route('/about', 'about.tsx'),
])
```

### `index(file)`

Creates an index route — the default rendered when the parent path matches exactly.

```ts
import { index } from '@tanstack/virtual-file-routes'

index('home.tsx')
```

### `route(path, ...)`

Creates a route node. Three call signatures:

```ts
import { route, index } from '@tanstack/virtual-file-routes'

// Leaf route: path + file
route('/about', 'about.tsx')

// Branch route: path + file + children
route('/dashboard', 'dashboard.tsx', [
  index('dashboard-index.tsx'),
  route('/settings', 'settings.tsx'),
])

// Path prefix only (no file): groups children under a URL segment
route('/api', [route('/users', 'users.tsx'), route('/posts', 'posts.tsx')])
```

### `layout(file, children)` or `layout(id, file, children)`

Creates a pathless layout route — wraps children without adding a URL segment.

```ts
import { layout, route, index } from '@tanstack/virtual-file-routes'

// ID derived from filename
layout('authLayout.tsx', [
  route('/dashboard', 'dashboard.tsx'),
  route('/settings', 'settings.tsx'),
])

// Explicit ID
layout('admin-layout', 'adminLayout.tsx', [route('/admin', 'admin.tsx')])
```

### `physical(pathPrefix, directory)` or `physical(directory)`

Mounts a directory of file-based routes at a URL prefix. Uses TanStack Router's standard file-based routing conventions within that directory.

```ts
import { physical } from '@tanstack/virtual-file-routes'

// Mount posts/ directory under /posts
physical('/posts', 'posts')

// Merge features/ directory at the current level
physical('features')
```

### `defineVirtualSubtreeConfig(config)`

Type helper for `__virtual.ts` files inside file-based routing directories. Identity function that provides type inference.

```ts
// src/routes/admin/__virtual.ts
import {
  defineVirtualSubtreeConfig,
  index,
  route,
} from '@tanstack/virtual-file-routes'

export default defineVirtualSubtreeConfig([
  index('home.tsx'),
  route('$id', 'details.tsx'),
])
```

## Integration with Router Plugin

Pass the virtual route config to the TanStack Router plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { routes } from './routes'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react', // or 'solid', 'vue'
      virtualRouteConfig: routes,
    }),
    // Add your framework's Vite plugin here
  ],
})
```

Or reference a file path:

```ts
tanstackRouter({
  target: 'react',
  virtualRouteConfig: './routes.ts',
})
```

## Full Example

```ts
// routes.ts
import {
  rootRoute,
  route,
  index,
  layout,
  physical,
} from '@tanstack/virtual-file-routes'

export const routes = rootRoute('root.tsx', [
  index('index.tsx'),

  layout('authLayout.tsx', [
    route('/dashboard', 'app/dashboard.tsx', [
      index('app/dashboard-index.tsx'),
      route('/invoices', 'app/dashboard-invoices.tsx', [
        index('app/invoices-index.tsx'),
        route('$id', 'app/invoice-detail.tsx'),
      ]),
    ]),
  ]),

  // Mount file-based routing from posts/ directory
  physical('/posts', 'posts'),
])
```

## Common Mistakes

### 1. HIGH: Forgetting that file paths are relative to routesDirectory

File paths in `rootRoute`, `index`, `route`, and `layout` are relative to the `routesDirectory` configured in the router plugin (default: `./src/routes`). Do not use absolute paths or paths relative to the project root.

```ts
// WRONG — absolute path
route('/about', '/src/routes/about.tsx')

// CORRECT — relative to routesDirectory
route('/about', 'about.tsx')
```

### 2. MEDIUM: Using physical() without matching directory structure

The directory passed to `physical()` must exist inside `routesDirectory` and follow TanStack Router's file-based routing conventions.

```ts
// WRONG — directory doesn't exist or wrong location
physical('/blog', 'src/blog')

// CORRECT — relative to routesDirectory
physical('/blog', 'blog')
// Expects: src/routes/blog/ (with route files inside)
```

### 3. MEDIUM: Confusing layout() with route()

`layout()` creates a pathless wrapper — it does NOT add a URL segment. Use `route()` for URL segments.

```ts
// This does NOT create a /dashboard URL
layout('dashboardLayout.tsx', [route('/dashboard', 'dashboard.tsx')])

// The URL is /dashboard, and dashboardLayout.tsx wraps it
```
