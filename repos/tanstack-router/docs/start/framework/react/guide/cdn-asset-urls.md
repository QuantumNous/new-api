---
id: cdn-asset-urls
title: CDN Asset URLs
---

# CDN Asset URLs

> **Experimental:** `transformAssets` is experimental and subject to change.

Use this guide when you need TanStack Start to rewrite manifest-managed asset URLs at runtime. The most common use case is serving JavaScript and CSS from a CDN whose origin is known only when the server starts, or varies per request.

This guide is about asset URL rewriting. For choosing CSS import patterns and configuring CSS inlining, see the [CSS Styling guide](./css-styling).

## What `transformAssets` Rewrites

The `transformAssets` option on `createStartHandler` rewrites URLs that Start manages in its SSR manifest:

- JavaScript preload links (`<link rel="modulepreload">` for module output, or `<link rel="preload" as="script">` for IIFE output)
- `<link rel="stylesheet">` tags for manifest-managed CSS
- The client entry script URL
- `url(...)` and `@import` URLs inside [inlined CSS](./css-styling#inline-route-css-in-production) when CSS URL templates are enabled

It does not rewrite every URL in your app. In particular, it does not rewrite arbitrary route `head().links` entries, including CSS imported with `?url` and returned from route `head()` functions. See [What This Does Not Rewrite](#what-this-does-not-rewrite) for the main exclusions.

## Use a Static CDN Prefix

Pass a string when every Start-managed asset should receive the same URL prefix.

```tsx
// src/server.ts
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'

const handler = createStartHandler({
  handler: defaultStreamHandler,
  transformAssets: process.env.CDN_ORIGIN || '',
})

export default createServerEntry({ fetch: handler })
```

If `CDN_ORIGIN` is `https://cdn.example.com` and an asset URL is `/assets/index-abc123.js`, Start renders `https://cdn.example.com/assets/index-abc123.js`.

When the string is empty or not set, URLs are left unchanged.

## Add Cross-Origin Attributes

Use the object shorthand when you also need to set `crossOrigin` on manifest-managed `<link>` tags.

```tsx
// src/server.ts
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'

const handler = createStartHandler({
  handler: defaultStreamHandler,
  transformAssets: {
    prefix: process.env.CDN_ORIGIN || '',
    crossOrigin: 'anonymous',
  },
})

export default createServerEntry({ fetch: handler })
```

`crossOrigin` accepts either one value for all supported link kinds, or a per-kind record that matches the `HeadContent assetCrossOrigin` shape.

```tsx
transformAssets: {
  prefix: 'https://cdn.example.com',
  crossOrigin: {
    script: 'anonymous',
    stylesheet: 'use-credentials',
  },
}
```

Kinds not listed in the per-kind record receive no `crossOrigin` attribute. The string shorthand and object shorthand are cached by default.

You can also set cross-origin behavior from your app shell with `HeadContent`:

```tsx
<HeadContent assetCrossOrigin="anonymous" />
```

or:

```tsx
<HeadContent
  assetCrossOrigin={{
    script: 'anonymous',
    stylesheet: 'use-credentials',
  }}
/>
```

If both `transformAssets` and `assetCrossOrigin` set a cross-origin value, `assetCrossOrigin` overrides the value from `transformAssets`. `assetCrossOrigin` only applies to manifest-managed script and stylesheet links, not arbitrary links returned from route `head()` functions.

## Use a Callback for Per-Asset Logic

Pass a callback when the output depends on the asset kind or URL. The callback returns a string, `{ href, crossOrigin? }`, or a `Promise` of either.

```tsx
// src/server.ts
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'

const handler = createStartHandler({
  handler: defaultStreamHandler,
  transformAssets: (asset) => {
    const href = `https://cdn.example.com${asset.url}`

    if (asset.kind === 'script') {
      return {
        href,
        crossOrigin: 'anonymous',
      }
    }

    return { href }
  },
})

export default createServerEntry({ fetch: handler })
```

The `kind` field tells you which asset URL is being transformed.

| `kind`         | Description                                    |
| -------------- | ---------------------------------------------- |
| `'script'`     | JavaScript preload or client entry script URL  |
| `'stylesheet'` | Manifest-managed CSS stylesheet URL            |
| `'css-url'`    | `url(...)` or `@import` URL inside inlined CSS |

For `kind === 'css-url'`, the context also includes `stylesheetHref`, which is the manifest stylesheet href whose CSS content is being inlined.

`crossOrigin` applies to manifest-managed script and stylesheet tags. For CSS-internal URLs, returning `{ href }` is equivalent to returning a string.

By default, callback results are cached after the first request in production. Use the object form with `cache: false` only when the transform depends on per-request data.

## Handle Per-Request CDN Selection

Use the object form with `cache: false` when the CDN origin depends on the current request, such as a request header, tenant, or region.

```tsx
// src/server.ts
import {
  createStartHandler,
  defaultStreamHandler,
  getRequest,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'

const handler = createStartHandler({
  handler: defaultStreamHandler,
  transformAssets: {
    transform: ({ kind, url }) => {
      const region = getRequest().headers.get('x-region') || 'us'
      const cdnBase =
        region === 'eu'
          ? 'https://cdn-eu.example.com'
          : 'https://cdn-us.example.com'

      if (kind === 'script') {
        return {
          href: `${cdnBase}${url}`,
          crossOrigin: 'anonymous',
        }
      }

      return { href: `${cdnBase}${url}` }
    },
    cache: false,
  },
})

export default createServerEntry({ fetch: handler })
```

The object form accepts these properties:

| Property          | Type                                                                                                                            | Description                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `transform`       | `string \| (asset) => string \| { href, crossOrigin? } \| Promise<...>`                                                         | A string prefix or callback, same as the shorthand forms above.                                                               |
| `createTransform` | `(ctx: { warmup: true } \| { warmup: false; request: Request }) => (asset) => string \| { href, crossOrigin? } \| Promise<...>` | Async factory that runs once per manifest computation and returns a per-asset transform. Mutually exclusive with `transform`. |
| `cache`           | `boolean`                                                                                                                       | Whether to cache the transformed manifest. Defaults to `true`.                                                                |
| `warmup`          | `boolean`                                                                                                                       | When `true`, warms up the cached manifest on server startup in production. Defaults to `false`.                               |

Use `createTransform` when you need to do async work once per manifest computation, then transform many URLs with the result.

```ts
transformAssets: {
  cache: false,
  async createTransform(ctx) {
    if (ctx.warmup) {
      return ({ url }) => ({ href: url })
    }

    const region = ctx.request.headers.get('x-region') || 'us'
    const cdnBase = await fetchCdnBaseForRegion(region)

    return (asset) => {
      if (asset.kind === 'script') {
        return {
          href: `${cdnBase}${asset.url}`,
          crossOrigin: 'anonymous',
        }
      }

      return { href: `${cdnBase}${asset.url}` }
    }
  },
}
```

For a static CDN prefix, prefer the string or object shorthand. They are simpler and use the default cached manifest.

## Transform URLs Inside Inlined CSS

When Start's [CSS inlining](./css-styling#inline-route-css-in-production) is enabled, Start can also run `transformAssets` for URLs inside the inlined CSS content. This covers relative and root-relative `url(...)` and `@import` values, such as fonts and background images.

Because Start does not parse CSS at runtime, this requires opting into build-time CSS URL templates:

```ts
tanstackStart({
  server: {
    build: {
      inlineCss: {
        enabled: true,
        transformAssets: true,
      },
    },
  },
})
```

Passing `inlineCss: true` still inlines route CSS, but it does not emit the template metadata needed for runtime CSS URL transforms.

Relative CSS URLs are resolved against the emitted stylesheet href before your transform runs.

```css
/* emitted stylesheet href: /assets/dashboard.css */
.card {
  background-image: url('./dot.svg');
}
```

Your callback receives `/assets/dot.svg` with `kind: 'css-url'`. For example, you can serve JavaScript and CSS files from one CDN origin, and font or image URLs referenced inside inlined CSS from another origin.

```tsx
const handler = createStartHandler({
  handler: defaultStreamHandler,
  transformAssets: (asset) => {
    if (asset.kind === 'css-url') {
      return `https://static-assets.example.com${asset.url}`
    }

    return `https://cdn.example.com${asset.url}`
  },
})
```

When `asset.kind === 'css-url'`, the URL came from inside an inlined CSS file, such as a `url(...)` or `@import` reference. The callback context also includes `stylesheetHref`, which identifies the generated stylesheet that contained that URL. Use it when the transform needs to vary based on the source stylesheet.

```tsx
transformAssets: (asset) => {
  if (asset.kind === 'css-url') {
    const cdnBase = asset.stylesheetHref.includes('/admin-')
      ? 'https://admin-cdn.example.com'
      : 'https://cdn.example.com'

    return `${cdnBase}${asset.url}`
  }

  return `https://cdn.example.com${asset.url}`
}
```

Absolute URLs, protocol-relative URLs, data URLs, and hash references inside CSS are left unchanged and are not passed to `transformAssets`. If CSS URL templates were not enabled for the build, URLs inside inlined CSS are left unchanged at runtime.

## Choose When URL Rewrites Are Cached

In most apps, the CDN URL is the same for every request. Keep the default caching behavior for that case. Start computes the transformed manifest once in production, then reuses it for later requests.

Only turn caching off when the result can change per request, such as choosing a CDN by region, tenant, header, or cookie.

| Form                                 | Default cache | Behavior                                                    |
| ------------------------------------ | ------------- | ----------------------------------------------------------- |
| String prefix                        | `true`        | Computed once, cached in production.                        |
| Object shorthand                     | `true`        | Computed once, cached in production.                        |
| Callback                             | `true`        | Runs once on first request, cached in production.           |
| Object with `cache: true` or omitted | `true`        | Same as above.                                              |
| Object with `cache: false`           | `false`       | Deep-clones the base manifest and transforms every request. |

Use `cache: false` only when the transform depends on per-request data. For static CDN prefixes, the default `cache: true` is faster and simpler.

If you want to avoid doing the first cached rewrite during the first user request, set `warmup: true`. Start will compute the transformed manifest in the background when the server starts.

```ts
transformAssets: {
  transform: process.env.CDN_ORIGIN || '',
  cache: true,
  warmup: true,
}
```

Warmup has no effect in development mode or when `cache: false`.

> **Note:** In development mode (`TSS_DEV_SERVER`), caching is always skipped regardless of the `cache` setting, so you always get fresh manifests.

## Keep Client Navigation Chunks on the CDN

`transformAssets` rewrites the URLs in the SSR HTML: script preload hints, stylesheet links, and the client entry script. This means the browser's initial page load can fetch those assets from the CDN.

When users navigate client-side, TanStack Router lazy-loads route chunks using `import()` calls with paths baked in by the bundler. Configure your bundler so those async chunk URLs resolve relative to the client entry script that `transformAssets` rewrites to the CDN.

<!-- ::start:tabs variant="bundler" -->

# Vite

With Vite's default `base: '/'`, lazy route chunk paths are absolute, such as `/assets/about-abc123.js`, and resolve against the app server origin instead of the CDN.

For Vite builds, set `base: ''` so Vite generates relative import paths for client-side chunks.

```ts title="vite.config.ts"
import { defineConfig } from 'vite'

export default defineConfig({
  base: '',
  // ... plugins, etc.
})
```

With `base: ''`, the client entry script can be loaded from the CDN by `transformAssets`, and relative `import()` calls resolve against that same CDN origin. This keeps lazy-loaded route chunks on the CDN during client-side navigation.

Using an empty string rather than `'./'` is important. Both produce relative client-side imports, but `base: ''` preserves the root-relative paths in the SSR manifest so `transformAssets` can prepend the CDN origin correctly.

| `base` setting  | SSR assets on initial load    | Client-side navigation chunks |
| --------------- | ----------------------------- | ----------------------------- |
| `'/'` (default) | CDN through `transformAssets` | App server                    |
| `''`            | CDN through `transformAssets` | CDN, relative to entry module |

Use `base: ''` whenever you use `transformAssets` with Vite and want initial-load assets and client-navigation chunks served from the same CDN.

# Rsbuild

For Rsbuild builds, set `output.assetPrefix` to `'auto'` so Rspack derives async chunk URLs from the loaded client entry script.

```ts title="rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  output: {
    assetPrefix: 'auto',
  },
  // ... plugins, etc.
})
```

With `assetPrefix: 'auto'`, the client entry script can be loaded from the CDN by `transformAssets`, and async route chunks resolve relative to that entry script during client-side navigation.

<!-- ::end:tabs -->

## What This Does Not Rewrite

`transformAssets` rewrites Start manifest-managed assets and, when CSS URL templates are enabled, URLs inside CSS that Start inlines into the HTML.

It does not rewrite arbitrary links returned from route `head()` functions:

```tsx
import { createRootRoute } from '@tanstack/react-router'
import appCss from '../styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
})
```

If this stylesheet must use a CDN URL, use a bundler-level option or build-time configuration for that URL. If you want Start to manage the generated stylesheet URL, import the CSS as a side effect or CSS module instead. See [Choose a CSS Pattern](./css-styling#choose-a-css-pattern).

`transformAssets` also does not rewrite asset URLs imported directly in your components:

```tsx
// This import resolves to a URL at build time by your bundler.
import logo from './logo.svg'

function Header() {
  return <img src={logo} /> // This URL is not affected by transformAssets.
}
```

For these asset imports, use the URL controls provided by your bundler.

<!-- ::start:tabs variant="bundler" -->

# Vite

For Vite builds, use Vite's `experimental.renderBuiltUrl` in your `vite.config.ts`.

```ts title="vite.config.ts"
import { defineConfig } from 'vite'

export default defineConfig({
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js') {
        return { relative: true }
      }

      return `https://cdn.example.com/${filename}`
    },
  },
})
```

# Rsbuild

For Rsbuild builds where the CDN origin is known at build time, use `output.assetPrefix` in your `rsbuild.config.ts`.

```ts title="rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  output: {
    assetPrefix: 'https://cdn.example.com/',
  },
})
```

<!-- ::end:tabs -->
