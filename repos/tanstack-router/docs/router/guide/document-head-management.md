---
title: Document Head Management
---

Document head management is the process of managing the head, title, meta, link, and script tags of a document and TanStack Router provides a robust way to manage the document head for full-stack applications that use Start and for single-page applications that use TanStack Router. It provides:

- Automatic deduping of `title` and `meta` tags
- Automatic loading/unloading of tags based on route visibility
- A composable way to merge `title` and `meta` tags from nested routes

For full-stack applications that use Start, and even for single-page applications that use TanStack Router, managing the document head is a crucial part of any application for the following reasons:

- SEO
- Social media sharing
- Analytics
- CSS and JS loading/unloading

To manage the document head, it's required that you render both the `<HeadContent />` and `<Scripts />` components and use the `routeOptions.head` property to manage the head of a route, which returns an object with `title`, `meta`, `links`, `styles`, and `scripts` properties.

## Managing the Document Head

```tsx
export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        name: 'description',
        content: 'My App is a web application',
      },
      {
        title: 'My App',
      },
    ],
    links: [
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
    ],
    styles: [
      {
        media: 'all and (max-width: 500px)',
        children: `p {
                  color: blue;
                  background-color: yellow;
                }`,
      },
    ],
    scripts: [
      {
        src: 'https://www.google-analytics.com/analytics.js',
      },
    ],
  }),
})
```

### Deduping

Out of the box, TanStack Router will dedupe `title` and `meta` tags, preferring the **last** occurrence of each tag found in nested routes.

- `title` tags defined in nested routes will override a `title` tag defined in a parent route (but you can compose them together, which is covered in a future section of this guide)
- `meta` tags with the same `name` or `property` will be overridden by the last occurrence of that tag found in nested routes

### `<HeadContent />`

The `<HeadContent />` component is **required** to render the head, title, meta, link, and head-related script tags of a document.

It should be **rendered either in the `<head>` tag of your root layout or as high up in the component tree as possible** if your application doesn't or can't manage the `<head>` tag.

For manifest-managed assets, you can also set `crossorigin` values on emitted
script preload and stylesheet links:

```tsx
<HeadContent assetCrossOrigin="anonymous" />

<HeadContent
  assetCrossOrigin={{
    script: 'anonymous',
    stylesheet: 'use-credentials',
  }}
/>
```

`assetCrossOrigin` only applies to manifest-managed asset links emitted by Start.
If you also set `crossOrigin` via `transformAssets` (either the object shorthand
or a callback return value), `assetCrossOrigin` wins.

### Start/Full-Stack Applications

<!-- ::start:framework -->

# React

```tsx
import { HeadContent } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: () => (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  ),
})
```

# Solid

```tsx
import { HeadContent } from '@tanstack/solid-router'

export const Route = createRootRoute({
  component: () => (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
      </body>
    </html>
  ),
})
```

<!-- ::end:framework -->

### Single-Page Applications

First, remove the `<title>` tag from the index.html if you have set any.

<!-- ::start:framework -->

# React

```tsx
import { HeadContent } from '@tanstack/react-router'

const rootRoute = createRootRoute({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
})
```

# Solid

```tsx
import { HeadContent } from '@tanstack/solid-router'

const rootRoute = createRootRoute({
  component: () => (
    <>
      <HeadContent />
      <Outlet />
    </>
  ),
})
```

<!-- ::end:framework -->

## Managing Body Scripts

In addition to scripts that can be rendered in the `<head>` tag, you can also render scripts in the `<body>` tag using the `routeOptions.scripts` property. This is useful for loading scripts (even inline scripts) that require the DOM to be loaded, but before the main entry point of your application (which includes hydration if you're using Start or a full-stack implementation of TanStack Router).

To do this, you must:

- Use the `scripts` property of the `routeOptions` object
- [Render the `<Scripts />` component](#scripts)

```tsx
export const Route = createRootRoute({
  scripts: () => [
    {
      children: 'console.log("Hello, world!")',
    },
  ],
})
```

### `<Scripts />`

The `<Scripts />` component is **required** to render the body scripts of a document. It should be rendered either in the `<body>` tag of your root layout or as high up in the component tree as possible if your application doesn't or can't manage the `<body>` tag.

### Example

<!-- ::start:framework -->

# React

```tsx
import { createRootRoute, Scripts } from '@tanstack/react-router'
export const Route = createFileRoute('/')({
  component: () => (
    <html>
      <head />
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
})
```

# Solid

```tsx
import { createFileRoute, Scripts } from '@tanstack/solid-router'
export const Route = createRootRoute('/')({
  component: () => (
    <html>
      <head />
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  ),
})
```

<!-- ::end:framework -->

## Inline Scripts with ScriptOnce

For scripts that must run before React hydrates (like theme detection), use `ScriptOnce`. This is particularly useful for avoiding flash of unstyled content (FOUC) or theme flicker.

<!-- ::start:framework -->

# React

```tsx
import { ScriptOnce } from '@tanstack/react-router'

const themeScript = `(function() {
  try {
    const theme = localStorage.getItem('theme') || 'auto';
    const resolved = theme === 'auto'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.classList.add(resolved);
  } catch (e) {}
})();`

function ThemeProvider({ children }) {
  return (
    <>
      <ScriptOnce children={themeScript} />
      {children}
    </>
  )
}
```

# Solid

```tsx
import { ScriptOnce } from '@tanstack/solid-router'

const themeScript = `(function() {
  try {
    const theme = localStorage.getItem('theme') || 'auto';
    const resolved = theme === 'auto'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.classList.add(resolved);
  } catch (e) {}
})();`

function ThemeProvider({ children }) {
  return (
    <>
      <ScriptOnce children={themeScript} />
      {children}
    </>
  )
}
```

<!-- ::end:framework -->

### How ScriptOnce Works

1. During SSR, renders a `<script>` tag with the provided code
2. The script executes immediately when the browser parses the HTML (before React hydrates)
3. After execution, the script removes itself from the DOM
4. On client-side navigation, nothing is rendered (prevents duplicate execution)

<!-- ::start:framework -->

# React

### Preventing Hydration Warnings

If your script modifies the DOM before hydration (like adding a class to `<html>`), use `suppressHydrationWarning` to prevent React warnings:

```tsx
export const Route = createRootRoute({
  component: () => (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <Outlet />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  ),
})
```

<!-- ::end:framework -->

### Common Use Cases

- **Theme/dark mode detection** - Apply theme class before hydration to prevent flash
- **Feature detection** - Check browser capabilities before rendering
- **Analytics initialization** - Initialize tracking before user interaction
- **Critical path setup** - Any JavaScript that must run before hydration
