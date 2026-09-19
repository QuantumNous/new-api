---
id: spa-mode
title: SPA mode
---

## What the heck is SPA mode?

For applications that do not require SSR for either SEO, crawlers, or performance reasons, it may be desirable to ship static HTML to your users containing the "shell" of your application (or even prerendered HTML for specific routes) that contain the necessary `html`, `head`, and `body` tags to bootstrap your application only on the client.

## Why use Start without SSR?

**No SSR doesn't mean giving up server-side features!** SPA modes actually pair very nicely with server-side features like server functions and/or server routes or even other external APIs. It **simply means that the initial document will not contain the fully rendered HTML of your application until it has been rendered on the client using JavaScript**.

## Benefits of SPA mode

- **Easier to deploy** - A CDN that can serve static assets is all you need.
- **Cheaper** to host - CDNs are cheap compared to Lambda functions or long-running processes.
- **Client-side Only is simpler** - No SSR means less to go wrong with hydration, rendering, and routing.

## Caveats of SPA mode

- **Slower time to full content** - Time to full content is longer since all JS must download and execute before anything below the shell can be rendered.
- **Less SEO friendly** - Robots, crawlers and link unfurlers _may_ have a harder time indexing your application unless they are configured to execute JS and your application can render within a reasonable amount of time.

## How does it work?

After enabling the SPA mode, running a Start build will have an additional prerendering step afterwards to generate the shell. This is done by:

- **Prerendering** your application's **root route only**
- Where your application would normally render your matched routes, your router's configured **pending fallback component is rendered instead**.
- The resulting HTML is stored to a static HTML page called `/_shell.html` (configurable)
- Default rewrites are configured to redirect all 404 requests to the SPA mode shell

> [!NOTE]
> Other routes may also be prerendered and it is recommended to prerender as much as you can in SPA mode, but this is not required for SPA mode to work.

## Configuring SPA mode

To configure SPA mode, there are a few options you can add to your Start plugin's options:

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
export default defineConfig({
  plugins: [
    tanstackStart({
      spa: {
        enabled: true,
      },
    }),
  ],
})
```

# Rsbuild

```ts title="rsbuild.config.ts"
export default defineConfig({
  plugins: [
    tanstackStart({
      spa: {
        enabled: true,
      },
    }),
  ],
})
```

<!-- ::end:tabs -->

## Use Necessary Redirects

Deploying a purely client-side SPA to a host or CDN often requires the use of redirects to ensure that urls are properly rewritten to the SPA shell. The goal of any deployment should include these priorities in this order:

1. Ensure that static assets will always be served if they exist, e.g. /about.html. This is usually the default behavior for most CDNs
2. (Optional) Allow-list specific subpaths to be routed through to any dynamic server handlers, e.g. /api/\*\* (More on this below)
3. Ensure that all 404 requests are rewritten to the SPA shell, e.g. a catch-all redirect to /\_shell.html (or if you have configured your shell output path to be something custom, use that instead)

## Basic Redirects Example

Let's use Netlify's `_redirects` file to rewrite all 404 requests to the SPA shell.

```
# Catch all other 404 requests and rewrite them to the SPA shell
/* /_shell.html 200
```

## Allowing Server Functions and Server Routes

Again, using Netlify's `_redirects` file, we can allow-list specific subpaths to be routed through to the server.

```
# Allow requests to /_serverFn/* to be routed through to the server (If you have configured your server function base path to be something other than /_serverFn, use that instead)
/_serverFn/* /_serverFn/:splat 200

# Allow any requests to /api/* to be routed through to the server (Server routes can be created at any path, so you must ensure that any server routes you want to use are under this path, or simply add additional redirects for each server route base you want to expose)
/api/* /api/:splat 200

# Catch all other 404 requests and rewrite them to the SPA shell
/* /_shell.html 200
```

## Shell Mask Path

The default pathname used to generate the SPA shell is `/`. We call this the **shell mask path**. Since matched routes are not included, the pathname used to generate the shell is mostly irrelevant, but it's still configurable.

> [!NOTE]
> It's recommended to keep the default value of `/` as the shell mask path.

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
export default defineConfig({
  plugins: [
    tanstackStart({
      spa: {
        maskPath: '/app',
      },
    }),
  ],
})
```

# Rsbuild

```ts title="rsbuild.config.ts"
export default defineConfig({
  plugins: [
    tanstackStart({
      spa: {
        maskPath: '/app',
      },
    }),
  ],
})
```

<!-- ::end:tabs -->

## Prerendering Options

The prerender option is used to configure the prerendering behavior of the SPA shell, and accepts the same prerender options as found in our prerendering guide.

**By default, the following `prerender` options are set:**

- `outputPath`: `/_shell.html`
- `crawlLinks`: `false`
- `retryCount`: `0`

This means that by default, the shell will not be crawled for links to follow for additional prerendering, and will not retry prerendering fails.

You can always override these options by providing your own prerender options:

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
export default defineConfig({
  plugins: [
    tanstackStart({
      spa: {
        prerender: {
          outputPath: '/custom-shell',
          crawlLinks: true,
          retryCount: 3,
        },
      },
    }),
  ],
})
```

# Rsbuild

```ts title="rsbuild.config.ts"
export default defineConfig({
  plugins: [
    tanstackStart({
      spa: {
        prerender: {
          outputPath: '/custom-shell',
          crawlLinks: true,
          retryCount: 3,
        },
      },
    }),
  ],
})
```

<!-- ::end:tabs -->

## Customized rendering in SPA mode

Customizing the HTML output of the SPA shell can be useful if you want to:

- Provide generic head tags for SPA routes
- Provide a custom pending fallback component
- Change literally anything about the shell's HTML, CSS, and JS

To make this process simple, an `isShell()` function can be found on the `router` instance:

```tsx
// src/routes/root.tsx
export default function Root() {
  const isShell = useRouter().isShell()

  if (isShell) console.log('Rendering the shell!')
}
```

You can use this boolean to conditionally render different UI based on whether the current route is a shell or not, but keep in mind that after hydrating the shell, the router will immediately navigate to the first route and `isShell()` will return `false`. **This could produce flashes of unstyled content if not handled properly.**

## Dynamic Data in your Shell

Since the shell is prerendered using the SSR build of your application, any `loader`s, or server-specific functionality defined on your **Root Route** will run during the prerendering process and the data will be included in the shell.

This means that you can use dynamic data in your shell by using a `loader` or server-specific functionality.

```tsx
// src/routes/__root.tsx

export const RootRoute = createRootRoute({
  loader: async () => {
    return {
      name: 'Tanner',
    }
  },
  component: Root,
})

export default function Root() {
  const { name } = useLoaderData()

  return (
    <html>
      <body>
        <h1>Hello, {name}!</h1>
        <Outlet />
      </body>
    </html>
  )
}
```
