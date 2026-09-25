---
id: early-hints
title: Early Hints
---

# Early Hints

> **Experimental:** Early Hints are experimental and subject to change.

HTTP `103 Early Hints` lets your server tell the browser about important resources before the final HTML response is ready. TanStack Start can collect route assets and route `head().links`, then call your server entry so your runtime can send `103` responses.

Start does not send Early Hints automatically. Each deployment platform exposes a different API for writing informational responses, so your server entry decides how to send them.

## Choose How to Send Hints

Most apps should choose one of these patterns.

| Goal                              | Use                                             | Tradeoff                                    |
| --------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| Send hints as early as possible   | `phase === 'static'` with `links`               | May send hints for a request that redirects |
| Send only redirect-safe hints     | `phase === 'dynamic'` with `allLinks`           | Runs later, after route loading completes   |
| Let a CDN generate Early Hints    | `responseLinkHeader`                            | Only safe for public, cache-stable links    |
| Support runtimes without HTTP 103 | `responseLinkHeader` as a preload hint fallback | Does not hide server think time like `103`  |

Browsers generally process only the first `103` response for a navigation. Write at most one Early Hints response per request.

## Send Early Hints From Your Server Entry

Add `onEarlyHints` in `src/server.ts`, then pass the serialized `links` to your runtime's Early Hints API.

This example sends the earliest static hints:

```tsx
// src/server.ts
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request, {
      onEarlyHints: ({ phase, links }) => {
        if (phase !== 'static' || !links.length) return

        // Send `links` with your runtime-specific 103 API.
      },
    })
  },
})
```

Start can call `onEarlyHints` more than once for a request. `links` only contains values that were not emitted in an earlier phase. `allLinks` contains all deduped values collected so far.

## Choose When to Send Hints

`onEarlyHints` can run in two phases.

| Phase     | When it runs                                                  | What it contains                                                                                            |
| --------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `static`  | After route matching, before the router loads the route       | Manifest-managed assets for the matched routes                                                              |
| `dynamic` | After `router.load()` completes, unless the request redirects | Supported links returned by route `head()` functions, or an empty array when all hints were already emitted |

Use `static` when you want the browser to start loading known route assets as soon as possible. Static hints can run before route `beforeLoad` functions, so they may be sent for a request that later redirects.

Use `dynamic` when hints must be redirect-safe or loader-aware. If you want one `103` response that includes both static route assets and dynamic route `head()` links, wait for `dynamic` and send `allLinks`.

```tsx
onEarlyHints: ({ phase, allLinks }) => {
  if (phase !== 'dynamic' || !allLinks.length) return

  // Send one redirect-safe 103 with static and dynamic links.
  // Use `allLinks` with your runtime-specific 103 API.
}
```

The `dynamic` phase can run with empty `links`, so it can also be used as a post-load signal.

## Add Dynamic Hints From Route Head

Dynamic Early Hints come from supported route `head().links` entries after loaders have run.

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => getPost(params.postId),
  head: ({ loaderData }) => ({
    links: [
      {
        rel: 'preload',
        href: loaderData.heroImageUrl,
        as: 'image',
      },
    ],
  }),
})
```

The `dynamic` phase is skipped when `router.load()` produces a redirect.

Route `head().links` entries with `rel: 'stylesheet'` are converted to `rel=preload; as=style` for Early Hints. This includes stylesheets you import with `?url` and return from route `head()`. See [CSS Styling](./css-styling#know-when-css-is-discovered) for how CSS import patterns affect when Start discovers stylesheets.

## Use Response Link Headers as a Fallback

You can also attach collected hints to the final HTML response's HTTP `Link` header.

A response `Link` header does not hide server think time like a `103` response does, but the browser receives it before parsing the HTML body, so it can still start supported preloads and preconnects earlier than it would from HTML alone.

Response `Link` headers are most useful when:

- Your runtime cannot write `103` responses.
- Your CDN can generate Early Hints from response `Link` headers.

Start does not add response `Link` headers automatically. It cannot know whether those headers will be used only by the browser for the current response, stored by a shared cache, or replayed later as CDN-generated Early Hints.

This example appends all collected static and dynamic links to non-redirect HTML responses:

```tsx
// src/server.ts
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request, {
      responseLinkHeader: true,
    })
  },
})
```

## Filter Links Before Sending Them to a CDN

Some CDNs can read response `Link` headers, cache them, and emit their own `103` responses for later requests. For example, [Cloudflare Early Hints](https://developers.cloudflare.com/cache/advanced-configuration/early-hints/) can use `Link` headers from HTML responses.

Only let a shared cache or CDN replay links that are public and cache-stable for the response's cache boundary.

Good links to include are:

- Static route JavaScript and CSS assets.
- Public font, image, style, or fetch preloads with stable URLs.
- Public preconnect origins.

Avoid or filter links when they are:

- Authenticated, private, or user-specific.
- Signed, expiring, or otherwise short-lived.
- Derived from cookies, headers, query strings, A/B tests, or user data, unless the cache key varies on the same inputs.
- Unsafe to replay before your app authorizes the request.

Cloudflare documents several important caveats: its Early Hints cache ignores query strings, it can emit cached hints before reaching your origin or Worker, and it only generates hints from selected final response status codes and `Link` relations.

Because of those cache semantics, use response `Link` headers only when every emitted static or dynamic link is public and cache-stable for the request URI. Use `responseLinkHeader.filter` to remove links that are not safe for your cache boundary.

For example, this keeps only static manifest assets:

```tsx
handler.fetch(request, {
  responseLinkHeader: {
    filter: ({ phase }) => phase === 'static',
  },
})
```

## How CDN Asset Rewrites Affect Hints

Static Early Hints are collected from the final Start manifest resolved for the request. This means they follow the result of [`transformAssets`](./cdn-asset-urls):

- CDN URL rewrites are reflected in Early Hints.
- `crossOrigin` returned from `transformAssets` is reflected in Early Hints.
- JavaScript hints follow the client output format: `modulepreload` for module output, or `preload; as=script` for IIFE output.
- Per-request transforms with `cache: false` are reflected in Early Hints for that request.
- Inlined CSS assets are skipped when Start's [CSS inlining](./css-styling#inline-route-css-in-production) build option inlines them into the HTML.

## Event Shape

The callback receives an `EarlyHintsEvent`:

```ts
type EarlyHintsEvent = {
  phase: 'static' | 'dynamic'
  hints: ReadonlyArray<EarlyHint>
  links: Array<string>
  allHints: ReadonlyArray<EarlyHint>
  allLinks: Array<string>
}
```

`hints` is the structured form for the current phase. `links` is the serialized HTTP `Link` header form for the current phase. Both are deduped across phases, contain only new values, and are index-aligned.

`allHints` and `allLinks` contain all deduped values collected so far for the request. They are also index-aligned, and are useful when you want to write one combined `103` response during the `dynamic` phase.

The `responseLinkHeader.filter` callback receives entries with this shape:

```ts
type ResponseLinkHeaderEntry = {
  phase: 'static' | 'dynamic'
  hint: EarlyHint
  link: string
}
```

## Supported Links

Start emits Early Hints for link relations that map cleanly to HTTP `Link` headers:

- `preload`
- `modulepreload`
- `preconnect`
- `dns-prefetch`

Start serializes these attributes when present:

- `href`
- `rel`
- `as`
- `crossOrigin`
- `type`
- `integrity`
- `referrerPolicy`
- `fetchPriority`

Other head tags, inline styles, route scripts, and metadata are not converted into Early Hints.

HTML Early Hints processing does not apply `media`, `imageSrcSet`, or `imageSizes` until the final document exists, so Start does not serialize those attributes into `103` links.

## Runtime Example: Node

If your runtime exposes Node's `ServerResponse`, call `writeEarlyHints` with `links`. This example sends the earliest `static` hints:

```tsx
// src/server.ts
import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import type { ServerResponse } from 'node:http'

export default createServerEntry({
  fetch(request) {
    return handler.fetch(request, {
      onEarlyHints: ({ phase, links }) => {
        if (phase !== 'static' || !links.length) return

        const response = getNodeResponseSomehow(request) as
          | ServerResponse
          | undefined

        response?.writeEarlyHints({ link: links })
      },
    })
  },
})
```

Replace `getNodeResponseSomehow` with the API your adapter exposes.

## Runtime Example: srvx / Nitro on Node

Nitro uses [srvx](https://srvx.h3.dev/) under the hood for Node deployments. srvx exposes the native Node response on the request runtime context. This example waits for `dynamic` to send one redirect-safe response with both static and dynamic links:

```tsx
// src/server.ts
import handler from '@tanstack/react-start/server-entry'
import type { ServerRequest } from 'srvx'

export default {
  fetch(request: Request) {
    const serverRequest = request as ServerRequest

    return handler.fetch(request, {
      onEarlyHints: ({ phase, allLinks }) => {
        if (phase !== 'dynamic') return

        const response = serverRequest.runtime?.node?.res

        if (response?.writeEarlyHints && allLinks.length) {
          response.writeEarlyHints({ link: allLinks })
        }
      },
    })
  },
}
```

## Limitations

- Early Hints are skipped in the Start dev server.
- Start only mutates the response `Link` header when `responseLinkHeader` is enabled.
- Browsers generally process only the first `103` response for a navigation.
- Static hints can be sent before `beforeLoad` redirects are known.
- The runtime or proxy in front of your app must support HTTP `103` responses.
