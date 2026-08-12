---
title: Internationalization (i18n)
---

TanStack Router provides flexible and highly customizable primitives that can be composed to support common internationalization (i18n) routing patterns, such as **optional path parameters**, **route rewriting**, and **type-safe params**. This enables clean, SEO-friendly URLs, flexible locale handling, and seamless integration with i18n libraries.

This guide covers:

- Prefix-based and optional-locale routing
- Advanced routing patterns for i18n
- Language navigation and switching
- SEO considerations
- Type safety
- Integration patterns with i18n libraries (Paraglide)

---

## i18n with Optional Path Parameters

This pattern relies exclusively on TanStack Router features. It is suitable when:

- You want full control over translations
- You already manage translations manually
- You do not need automatic locale detection

Optional path parameters are ideal for implementing locale-aware routing without duplicating routes.

```
/{-$locale}/about
```

This single route matches:

- `/about` (default locale)
- `/en/about`
- `/fr/about`
- `/es/about`

### Prefix-based i18n

```tsx
// Route: /{-$locale}/about
export const Route = createFileRoute('/{-$locale}/about')({
  component: AboutComponent,
})

function AboutComponent() {
  const { locale } = Route.useParams()
  const currentLocale = locale || 'en'

  const content = {
    en: { title: 'About Us' },
    fr: { title: 'À Propos' },
    es: { title: 'Acerca de' },
  }

  return <h1>{content[currentLocale].title}</h1>
}
```

### Complex Routing Patterns

```tsx
// Route: /{-$locale}/blog/{-$category}/$slug
export const Route = createFileRoute('/{-$locale}/blog/{-$category}/$slug')({
  beforeLoad: ({ params }) => {
    const locale = params.locale || 'en'
    const validLocales = ['en', 'fr', 'es', 'de']

    if (params.locale && !validLocales.includes(params.locale)) {
      throw new Error('Invalid locale')
    }

    return { locale }
  },
})
```

### Language Switching

```tsx
<Link
  to="/{-$locale}/blog/{-$category}/$slug"
  params={(prev) => ({
    ...prev,
    locale: prev.locale === 'en' ? undefined : 'fr',
  })}
>
  Français
</Link>
```

### Type-safe Locales

```ts
type Locale = 'en' | 'fr' | 'es' | 'de'

function isLocale(value?: string): value is Locale {
  return ['en', 'fr', 'es', 'de'].includes(value as Locale)
}
```

---

## i18n Library Integration Patterns

TanStack Router is **library-agnostic**. You can integrate any i18n solution by mapping locale state to routing behavior.

Below is a recommended pattern using **Paraglide**.

---

## Client-side i18n with a Library (TanStack Router)

This pattern combines TanStack Router with a client-side i18n library. It is suitable when:

- You want type-safe translations
- You want localized URLs
- You do not need server-side rendering

### TanStack Router + Paraglide (Client-only)

Paraglide provides type-safe translations, locale detection, and URL localization that pair naturally with TanStack Router.

**GitHub example:**
[https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide](https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide)

### Project Setup

```bash
npx @inlang/paraglide-js@latest init
```

```ts
import { paraglideVitePlugin } from '@inlang/paraglide-js'

paraglideVitePlugin({
  project: './project.inlang',
  outdir: './app/paraglide',
})
```

### URL Localization via Router Rewrite

The router's `rewrite` option enables bidirectional URL transformation, perfect for locale prefixes. For comprehensive documentation on URL rewrites including advanced patterns, see the [URL Rewrites guide](./url-rewrites.md).

```ts
import { deLocalizeUrl, localizeUrl } from './paraglide/runtime'

const router = createRouter({
  routeTree,
  rewrite: {
    input: ({ url }) => deLocalizeUrl(url),
    output: ({ url }) => localizeUrl(url),
  },
})
```

---

## Server-side i18n (TanStack Start)

This pattern integrates i18n at the routing and server layers. It is suitable when:

- You use TanStack Start
- You need SSR or streaming
- You want locale-aware redirects and metadata

### TanStack Start + Paraglide

**GitHub example:**
[https://github.com/TanStack/router/tree/main/examples/react/start-i18n-paraglide](https://github.com/TanStack/router/tree/main/examples/react/start-i18n-paraglide)

### Server Middleware (SSR)

```ts
import { paraglideMiddleware } from './paraglide/server'

export default {
  fetch(req: Request) {
    return paraglideMiddleware(req, () => handler.fetch(req))
  },
}
```

### HTML Language Attribute

```tsx
import { getLocale } from '../paraglide/runtime'
;<html lang={getLocale()} />
```

---

## Offline-safe Redirects

For offline or client-only environments:

```ts
import { shouldRedirect } from '../paraglide/runtime'

beforeLoad: async () => {
  const decision = await shouldRedirect({ url: window.location.href })
  if (decision.redirectUrl) {
    throw redirect({ href: decision.redirectUrl.href })
  }
}
```

---

## Type-safe Translated Pathnames

To ensure every route has translations, you can derive translated pathnames directly from the TanStack Router route tree.

```ts
import { FileRoutesByTo } from '../routeTree.gen'
import { Locale } from '@/paraglide/runtime'
```

This guarantees:

- No missing translations
- Full type safety
- Compiler feedback for routing mistakes

---

## Prerendering Localized Routes

```ts
import { localizeHref } from './paraglide/runtime'

export const prerenderRoutes = ['/', '/about'].map((path) => ({
  path: localizeHref(path),
  prerender: { enabled: true },
}))
```

---

## Additional i18n Integration Patterns

### Intlayer (TanStack Start integration)

[https://intlayer.org/doc/environment/tanstack-start](https://intlayer.org/doc/environment/tanstack-start)

### use-intl (TanStack Start integration)

[https://nikuscs.com/blog/13-tanstackstart-i18n/](https://nikuscs.com/blog/13-tanstackstart-i18n/)
