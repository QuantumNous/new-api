# TanStack Start example with Paraglide

This example shows how to use Paraglide with TanStack Start.

- [TanStack Router Docs](https://tanstack.com/router)
- [Paraglide Documentation](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)

## Start a new project based on this example

To start a new project based on this example, run:

```sh
npx gitpick TanStack/router/tree/main/examples/react/start-i18n-paraglide start-i18n-paraglide
```

## Getting started

1. Init Paraglide JS

```bash
npx @inlang/paraglide-js@latest init
```

2. Add the vite plugin to your `vite.config.ts`:

```diff
import { defineConfig } from 'vite'
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from '@vitejs/plugin-react'
+import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
       plugins: [
    tanstackStart(),
    react(),
+              paraglideVitePlugin({
+                      project: "./project.inlang",
+                      outdir: "./app/paraglide",
+     outputStructure: "message-modules",
+     cookieName: "PARAGLIDE_LOCALE",
+     strategy: ["url", "cookie", "preferredLanguage", "baseLocale"],
+      urlPatterns: [
+       {
+         pattern: "/:path(.*)?",
+         localized: [
+           ["en", "/en/:path(.*)?"],
+         ],
+       },
+     ],
+              }),
       ],
});
```

3. Done :)

Run the app and start translating. See the [basics documentation](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/basics) for information on how to use Paraglide's messages, parameters, and locale management.

## Rewrite URL

If you want to handle how the URL looks when the user changes the locale, you can rewrite the URL in the router.

```diff
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
+import { deLocalizeUrl, localizeUrl } from "./paraglide/runtime.js";

const router = createRouter({
  routeTree,
+ rewrite: {
+   input: ({ url }) => deLocalizeUrl(url),
+   output: ({ url }) => localizeUrl(url),
  },
});
```

In `server.ts` intercept the request with the paraglideMiddleware.

```ts
import { paraglideMiddleware } from './paraglide/server.js'
import handler from '@tanstack/react-start/server-entry'
export default {
  fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, () => handler.fetch(req))
  },
}
```

In `__root.tsx` change the html lang attribute to the current locale.

```tsx
import { getLocale } from '../paraglide/runtime.js'

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang={getLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
```

## Offline redirect

If you have an application that needs to work offline, you will need to handle the redirect in the client like this.

```ts
import { shouldRedirect } from "../paraglide/runtime";

export const Route = createRootRoute({
  beforeLoad: async () => {
    const decision = await shouldRedirect({ url: window.location.href });

    if (decision.redirectUrl) {
      throw redirect({ href: decision.redirectUrl.href });
    }
  },
  ...
});
```

## Typesafe translated pathnames

If you don't want to miss any translated path, you can create a `createTranslatedPathnames` function and pass it to the vite plugin.

```ts
// i18n/lib.ts
import { Locale } from '@/paraglide/runtime'
import { FileRoutesByTo } from '../routeTree.gen'

type RoutePath = keyof FileRoutesByTo

const excludedPaths = ['admin', 'docs', 'api'] as const

type PublicRoutePath = Exclude<
  RoutePath,
  `${string}${(typeof excludedPaths)[number]}${string}`
>

type TranslatedPathname = {
  pattern: string
  localized: Array<[Locale, string]>
}

function toUrlPattern(path: string) {
  return (
    path
      // catch-all
      .replace(/\/\$$/, '/:path(.*)?')
      // optional parameters: {-$param}
      .replace(/\{-\$([a-zA-Z0-9_]+)\}/g, ':$1?')
      // named parameters: $param
      .replace(/\$([a-zA-Z0-9_]+)/g, ':$1')
      // remove trailing slash
      .replace(/\/+$/, '')
  )
}

function createTranslatedPathnames(
  input: Record<PublicRoutePath, Record<Locale, string>>,
): TranslatedPathname[] {
  return Object.entries(input).map(([pattern, locales]) => ({
    pattern: toUrlPattern(pattern),
    localized: Object.entries(locales).map(
      ([locale, path]) =>
        [locale as Locale, `/${locale}${toUrlPattern(path)}`] satisfies [
          Locale,
          string,
        ],
    ),
  }))
}

export const translatedPathnames = createTranslatedPathnames({
  '/': {
    en: '/',
    de: '/',
  },
  '/about': {
    en: '/about',
    de: '/ueber',
  },
})
```

And import into the Paraglide Vite plugin.

```ts
// vite.config.ts
import { translatedPathnames } from './i18n/lib'

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      // ... other options
      urlPatterns: translatedPathnames,
    }),
  ],
})
```

## Prerender routes

You can use the `localizeHref` function to map the routes to localized versions and import into the pages option in the TanStack Start plugin. For this to work you will need to compile paraglide before the build with the CLI.

```ts
import { localizeHref } from './paraglide/runtime'
export const prerenderRoutes = ['/', '/about'].map((path) => ({
  path: localizeHref(path),
  prerender: {
    enabled: true,
  },
}))
```

## About This Example

This example demonstrates:

- Multi-language support with Paraglide in TanStack Start
- Server-side translation
- Type-safe translations
- Locale-based routing
