# TanStack Router - i18n with Paraglide Example

This example shows how to use Paraglide with TanStack Router.

- [TanStack Router Docs](https://tanstack.com/router)
- [Paraglide Documentation](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)

## Start a new project based on this example

To start a new project based on this example, run:

```sh
npx gitpick TanStack/router/tree/main/examples/react/i18n-paraglide i18n-paraglide
```

## Getting started

1. Init Paraglide JS

```bash
npx @inlang/paraglide-js@latest init
```

2. Add the vite plugin to your `vite.config.ts`:

```diff
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
+import { paraglideVitePlugin } from "@inlang/paraglide-js";

export default defineConfig({
       plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
+              paraglideVitePlugin({
+                      project: "./project.inlang",
+                      outdir: "./app/paraglide",
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

In `__root.tsx` add a `beforeLoad` hook to check if the user should be redirected and set the html `lang` attribute.

Intercept the request in `server.ts` with the paraglideMiddleware:

```ts
import { paraglideMiddleware } from './paraglide/server.js'
import handler from '@tanstack/react-start/server-entry'
export default {
  fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, ({ request }) => handler.fetch(request))
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

## Server-side rendering

For server-side rendering, check out the [TanStack Start guide](https://github.com/TanStack/router/tree/main/examples/react/start-i18n-paraglide).

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

- Multi-language support with Paraglide
- Type-safe translations
- Locale-based routing
- Language switching
- i18n best practices
