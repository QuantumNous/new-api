---
id: css-styling
title: CSS Styling
---

TanStack Start supports the CSS patterns your bundler supports, and adds SSR-aware route asset discovery on top.

Use this guide to choose how to import CSS in a React Start app, and how to configure production CSS behavior such as SSR stylesheet links, Early Hints, and CSS inlining.

## Choose a CSS Pattern

Start handles CSS differently depending on how you import it.

| Pattern                                  | Use it when                                           | SSR behavior                                          | Production features                                 |
| ---------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `import css from './app.css?url'`        | You want to put a stylesheet URL in route `head()`    | Rendered from `head().links`                          | Dynamic Early Hints                                 |
| `import './global.css'`                  | You want global CSS attached to a route chunk         | Discovered from the Start manifest for matched routes | Static Early Hints, `transformAssets`, CSS inlining |
| `import styles from './card.module.css'` | You want scoped class names attached to a route chunk | Discovered from the Start manifest for matched routes | Static Early Hints, `transformAssets`, CSS inlining |

Use `?url` when the stylesheet is part of your route head output. Use side-effect CSS imports or CSS modules when you want Start to treat the generated stylesheet as a route asset.

## Use `?url` for Explicit Stylesheet Links

Import CSS with `?url` when you want the bundler to return the emitted stylesheet URL and you want to render the `<link rel="stylesheet">` yourself.

```tsx
// src/routes/__root.tsx
/// <reference types="vite/client" />
import { createRootRoute } from '@tanstack/react-router'
import appCss from '../styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
})
```

This pattern is useful for explicit global stylesheets, especially when you already want the stylesheet to be part of route `head()` output. The CSS file is emitted by the bundler, and `HeadContent` places the stylesheet link in the final document.

`?url` stylesheet links are route head output, not Start manifest-managed stylesheet assets. Because of that:

- They are discovered when route `head()` runs.
- They can appear in the `dynamic` Early Hints phase as route `head().links` entries.
- They are not rewritten by Start's runtime [`transformAssets`](./cdn-asset-urls) option.
- They are not inlined by Start CSS inlining.

Use this pattern when explicit control of the route head is more important than Start's manifest-managed CSS features.

## Use Side-Effect Imports for Global Route CSS

Import CSS without assigning it when you want global selectors, global class names, or CSS custom properties to be bundled with a route or component module.

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import '../styles/global.css'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return <div className="global-container">Global CSS</div>
}
```

The class names remain global. Start discovers the generated CSS asset from the client build and attaches it to the matching route manifest entry. During SSR, `HeadContent` renders stylesheet links for the matched route tree, so the page is styled before hydration.

Where you import the CSS controls when it is loaded:

- Import in the root route or app shell to apply it to every page.
- Import in a layout route to apply it to that layout and its child routes.
- Import in a leaf route to load it only when that route is matched.
- Import from a component loaded with `import()` or `React.lazy` only when the CSS is not needed for the initial route render.

CSS imported from an async component loads with that async chunk. It is not part of Start's static route manifest for the initial route match, so `HeadContent` does not render it as an initial SSR stylesheet link, and it is not available for static Early Hints or CSS inlining.

Side-effect CSS imports are a good fit for app-wide CSS resets, design tokens, global utility classes, and route-level global styles.

## Use CSS Modules for Scoped Route CSS

CSS modules work like side-effect CSS imports from Start's route asset discovery perspective, but the class names are scoped by the bundler.

```tsx
// src/routes/modules.tsx
import { createFileRoute } from '@tanstack/react-router'
import styles from '../styles/card.module.css'

export const Route = createFileRoute('/modules')({
  component: Modules,
})

function Modules() {
  return <div className={styles.card}>Scoped CSS module</div>
}
```

The generated stylesheet is discovered from the route chunk graph, linked during SSR for matched routes, and loaded during client navigation when the route chunk loads.

Use CSS modules for route-local or component-local styling when you want scoped class names and Start-managed stylesheet assets.

## Know When CSS Is Discovered

The import pattern you choose controls when Start can see the stylesheet.

CSS from side-effect imports and CSS modules is discovered at build time. Start inspects the client build output, records CSS emitted for route chunks, and uses that manifest during SSR. Because Start already knows about these stylesheets before route loaders run, they can be sent in the `static` Early Hints phase as `rel=preload; as=style` links.

CSS imported with `?url` is different. Start sees that stylesheet only when route `head()` returns the link, which happens after `router.load()`. These links can still be sent as Early Hints, but only in the `dynamic` phase with other supported route `head().links` entries.

Use this rule of thumb:

- Use side-effect imports or CSS modules when you want Start to discover route CSS as early as possible.
- Use `?url` when you want explicit route `head()` control and are comfortable with later discovery.
- Use `allLinks` in the `dynamic` phase when you want one combined Early Hints response with both static manifest assets and dynamic head links.
- If CSS inlining is enabled, inlined manifest-managed stylesheet assets are skipped by static Early Hints because they are embedded in the HTML.

See the [Early Hints guide](./early-hints) for the callback and response header APIs.

## Inline Route CSS in Production

> **Experimental:** CSS inlining is experimental and subject to change.

CSS inlining embeds Start manifest-managed route CSS directly into the server-rendered HTML response for production builds. This can improve the first render by avoiding blocking stylesheet requests for the CSS needed by the initial route match.

Enable it with `server.build.inlineCss` in the Start plugin options. Passing `true` is shorthand for `{ enabled: true, transformAssets: false }`.

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        build: {
          inlineCss: true,
        },
      },
    }),
  ],
})
```

# Rsbuild

```ts title="rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

export default defineConfig({
  plugins: [
    tanstackStart({
      server: {
        build: {
          inlineCss: true,
        },
      },
    }),
  ],
})
```

<!-- ::end:tabs -->

This option only affects production builds. Development mode keeps using Start's normal development CSS handling.

CSS inlining applies to CSS discovered from side-effect imports and CSS modules, because those stylesheets are Start manifest assets. It does not inline CSS imported with `?url` and returned from `head().links`, because those links are dynamic route head output rather than manifest-managed stylesheet assets.

When CSS inlining is enabled, Start still emits CSS files in the client build. It only changes the SSR document: stylesheet links managed by the Start manifest are replaced with a single inline `<style>` tag for the matched routes. The inline style is preserved during hydration to avoid duplicate stylesheet links and hydration mismatches.

### Control Inlining at Runtime

You can control inlining per request in your server entry. This only affects builds created with `server.build.inlineCss` enabled.

```tsx
// src/server.ts
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createServerEntry } from '@tanstack/react-start/server-entry'

const handler = createStartHandler({
  handler: defaultStreamHandler,
  inlineCss: ({ request }) => request.headers.get('x-inline-css') !== 'false',
})

export default createServerEntry({ fetch: handler })
```

For custom runtime wrappers, `handler(request, { inlineCss })` overrides the handler-level `inlineCss` setting for that request.

```tsx
export default createServerEntry({
  fetch(request) {
    return handler(request, {
      inlineCss: request.headers.get('x-inline-css') !== 'false',
    })
  },
})
```

### URL Rebasing

If an inlined stylesheet contains relative `url(...)` or `@import` references, Start rebases them relative to the emitted CSS asset URL before embedding the CSS.

For example, when the generated stylesheet is served from `/_build/assets/dashboard.css`:

```css
.card {
  background-image: url('./dot.svg');
}
```

Start embeds it as:

```css
.card {
  background-image: url(/_build/assets/dot.svg);
}
```

Root-relative URLs are left unchanged at build time. Absolute URLs, protocol-relative URLs, data URLs, and hash references are also left unchanged.

If you need to rewrite CSS-internal URLs at runtime, such as prepending a CDN origin to fonts or background images, opt into CSS URL templates with `server.build.inlineCss: { enabled: true, transformAssets: true }`. See [Transform URLs Inside Inlined CSS](./cdn-asset-urls#transform-urls-inside-inlined-css) for the detailed `transformAssets` behavior.

### Tradeoffs

CSS inlining is useful when the matched route CSS is small enough that putting it in the HTML is cheaper than an extra stylesheet request. It can be less effective when your initial route loads a large global stylesheet that would otherwise be cached as a separate file.

Consider these tradeoffs before enabling it:

- The HTML response becomes larger.
- First-load CSS can no longer be cached independently from the HTML response.
- Strict Content Security Policy setups must allow the inline style. Configure `ssr.nonce` on the router so `HeadContent` can apply the nonce to rendered `<style>` tags, including inlined CSS.
- CSS files are still emitted for client navigation and browser caching after the initial response.

Use CSS inlining when the reduced request overhead is worth the larger HTML response for your deployment and route structure.

## Configure Production CSS Behavior

Use these options together based on what you need in production.

| Need                                      | Use                                                  |
| ----------------------------------------- | ---------------------------------------------------- |
| Explicit stylesheet links in route head   | `?url` imports returned from `head().links`          |
| SSR links for route CSS                   | Side-effect imports or CSS modules                   |
| Earliest CSS Early Hints                  | Side-effect imports or CSS modules with static hints |
| Redirect-safe stylesheet Early Hints      | `?url` imports with dynamic hints                    |
| Fewer blocking CSS requests on first load | `server.build.inlineCss`                             |
| Runtime CDN rewriting for Start assets    | [`transformAssets`](./cdn-asset-urls)                |
