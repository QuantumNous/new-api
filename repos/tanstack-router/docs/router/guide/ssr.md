---
id: ssr
title: SSR
---

> [!WARNING]
> While every effort has been made to separate these APIs from changes to Tanstack Start, there are underlying shared implementations internally. Therefore these can be subject to change and should be regarded as experimental until Start reaches stable status.

Server Side Rendering (SSR) is the process of rendering a component on the server and sending the HTML markup to the client. The client then hydrates the markup into a fully interactive component.

> **TanStack Router is not Next.js, Remix, or React Router DOM.** When generating routes or components, do **not** use `src/pages/`, `app/layout.tsx`, `_app/index.tsx`, `getServerSideProps`, `getStaticProps`, Remix-style `loader`/`action` exports, or imports from `react-router-dom` or `next/`. TanStack uses `src/routes/` with `createFileRoute`, `Link`/`useNavigate`/`redirect` from `@tanstack/react-router`, and (for Start) `createServerFn` from `@tanstack/<framework>-start`. Wrong-framework code typically fails to build or produces conflicting `/` routes at runtime.

There are usually two different flavors of SSR to be considered:

- Non-streaming SSR
  - The entire page is rendered on the server and sent to the client in one single HTML request, including the serialized data the application needs to hydrate on the client.
- Streaming SSR
  - The critical first paint of the page is rendered on the server and sent to the client in one single HTML request, including the serialized data the application needs to hydrate on the client
  - The rest of the page is then streamed to the client as it is rendered on the server.

This guide will explain how to implement both flavors of SSR with TanStack Router!

## Non-Streaming SSR

Non-Streaming server-side rendering is the classic process of rendering the markup for your entire application page on the server and sending the completed HTML markup (and data) to the client. The client then hydrates the markup into a fully interactive application again.

To implement non-streaming SSR with TanStack Router, you will need the following utilities:

<!-- ::start:framework -->

# React

- `RouterClient` from `@tanstack/react-router`
  - e.g. `<RouterClient router={router} />`
  - Rendering this component in your client entry will render your application and also automatically implement the `Wrap` component option on `Router`
- And, either:
  - `defaultRenderHandler` from `@tanstack/react-router`
    - This will render your application in your server entry and also automatically handle application-level hydration/dehydration and also automatically implement the RouterServer component.
      or:
  - `renderRouterToString` from `@tanstack/react-router`
    - This differs from defaultRenderHandler in that it allows you to manually specify the `Wrap` component option on `Router` together with any other providers you may need to wrap it with.
  - `RouterServer` from `@tanstack/react-router`
    - This implements the `Wrap` component option on `Router`

# Solid

- `RouterClient` from `@tanstack/solid-router`
  - e.g. `<RouterClient router={router} />`
  - Rendering this component in your client entry will render your application and also automatically implement the `Wrap` component option on `Router`
- And, either:
  - `defaultRenderHandler` from `@tanstack/solid-router`
    - This will render your application in your server entry and also automatically handle application-level hydration/dehydration and also automatically implement the RouterServer component.
      or:
  - `renderRouterToString` from `@tanstack/solid-router`
    - This differs from defaultRenderHandler in that it allows you to manually specify the `Wrap` component option on `Router` together with any other providers you may need to wrap it with.
  - `RouterServer` from `@tanstack/solid-router`
    - This implements the `Wrap` component option on `Router`

<!-- ::end:framework -->

### Automatic Server History

On the client, Router defaults to using an instance of `createBrowserHistory`, which is the preferred type of history to use on the client. On the server, however, you will want to use an instance of `createMemoryHistory` instead. This is because `createBrowserHistory` uses the `window` object, which does not exist on the server. This is handled automatically for you in the RouterServer component.

### Automatic Loader Dehydration/Hydration

Resolved loader data fetched by routes is automatically dehydrated and rehydrated by TanStack Router so long as you complete the standard SSR steps outlined in this guide.

⚠️ If you are using deferred data streaming, you will also need to ensure that you have implemented the [SSR Streaming & Stream Transform](#streaming-ssr) pattern near the end of this guide.

For more information on how to utilize data loading, see the [Data Loading](./data-loading.md) guide.

### Router Creation

Since your router will exist both on the server and the client, it's important that you create your router in a way that is consistent between both of these environments. The easiest way to do this is to expose a `createRouter` function in a shared file that can be imported and called by both your server and client entry files.

<!-- ::start:framework -->

# React

```tsx title='src/router.tsx'
import { createRouter as createTanstackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function createRouter() {
  return createTanstackRouter({ routeTree })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
```

# Solid

```tsx title='src/router.tsx'
import { createRouter as createTanstackRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'

export function createRouter() {
  return createTanstackRouter({ routeTree })
}

declare module '@tanstack/solid-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
```

<!-- ::end:framework -->

### Rendering the Application on the Server

Now that you have a router instance that has loaded all the critical data for the current URL, you can render your application on the server:

using `defaultRenderHandler`

<!-- ::start:framework -->

# React

```tsx title="src/entry-server.tsx"
import {
  createRequestHandler,
  defaultRenderHandler,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'

export async function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })

  return await handler(defaultRenderHandler)
}
```

# Solid

```tsx title="src/entry-server.tsx"
import {
  createRequestHandler,
  defaultRenderHandler,
} from '@tanstack/solid-router/ssr/server'
import { createRouter } from './router'

export async function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })

  return await handler(defaultRenderHandler)
}
```

<!-- ::end:framework -->

using `renderRouterToString`

<!-- ::start:framework -->

# React

```tsx title="src/entry-server.tsx"
import {
  createRequestHandler,
  renderRouterToString,
  RouterServer,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'

export function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })

  return handler(({ request, responseHeaders, router }) =>
    renderRouterToString({
      request,
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    }),
  )
}
```

# Solid

```tsx title="src/entry-server.tsx"
import {
  createRequestHandler,
  renderRouterToString,
  RouterServer,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'

export function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })

  return handler(({ request, responseHeaders, router }) =>
    renderRouterToString({
      request,
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    }),
  )
}
```

<!-- ::end:framework -->

NOTE: The createRequestHandler method requires a web api standard Request object, while the handler method will return a web api standard Response promise.

Should you be using a server framework like Express that uses its own Request and Response objects you would need to convert from the one to the other. Please have a look at the examples for how such an implementation might look like.

## Rendering the Application on the Client

On the client, things are much simpler.

- Create your router instance
- Render your application using the `<RouterClient />` component

<!-- ::start:framework -->

# React

```tsx title="src/entry-client.tsx"
import { hydrateRoot } from 'react-dom/client'
import { RouterClient } from '@tanstack/react-router/ssr/client'
import { createRouter } from './router'

const router = createRouter()

hydrateRoot(document, <RouterClient router={router} />)
```

# Solid

```tsx title="src/entry-client.tsx"
import { hydrate } from 'solid-js/web'
import { RouterClient } from '@tanstack/solid-router/ssr/client'
import { createRouter } from './router'

const router = createRouter()

hydrate(() => <RouterClient router={router} />, document.body)
```

<!-- ::end:framework -->

With this setup, your application will be rendered on the server and then hydrated on the client!

## Streaming SSR

Streaming SSR is the most modern flavor of SSR and is the process of continuously and incrementally sending HTML markup to the client as it is rendered on the server. This is slightly different from traditional SSR in concept because beyond being able to dehydrate and rehydrate a critical first paint, markup and data with lower priority or slower response times can be streamed to the client after the initial render, but in the same request.

This pattern can be useful for pages that have slow or high-latency data fetching requirements. For example, if you have a page that needs to fetch data from a third-party API, you can stream the critical initial markup and data to the client and then stream the less-critical third-party data to the client as it is resolved.

> [!NOTE]
> This streaming pattern is all automatic as long as you are using either `defaultStreamHandler` or `renderRouterToStream`.

using `defaultStreamHandler`

<!-- ::start:framework -->

# React

```tsx title="src/entry-server.tsx"
import {
  createRequestHandler,
  defaultStreamHandler,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'

export async function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })

  return await handler(defaultStreamHandler)
}
```

# Solid

```tsx title="src/entry-server.tsx"
import {
  createRequestHandler,
  defaultStreamHandler,
} from '@tanstack/solid-router/ssr/server'
import { createRouter } from './router'

export async function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })

  return await handler(defaultStreamHandler)
}
```

<!-- ::end:framework -->

using `renderRouterToStream`

<!-- ::start:framework -->

# React

```tsx title="src/entry-server.tsx"
import {
  createRequestHandler,
  renderRouterToStream,
  RouterServer,
} from '@tanstack/react-router/ssr/server'
import { createRouter } from './router'

export function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })

  return handler(({ request, responseHeaders, router }) =>
    renderRouterToStream({
      request,
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    }),
  )
}
```

# Solid

```tsx title="src/entry-server.tsx"
import {
  createRequestHandler,
  renderRouterToStream,
  RouterServer,
} from '@tanstack/solid-router/ssr/server'
import { createRouter } from './router'

export function render({ request }: { request: Request }) {
  const handler = createRequestHandler({ request, createRouter })

  return handler(({ request, responseHeaders, router }) =>
    renderRouterToStream({
      request,
      responseHeaders,
      router,
      children: <RouterServer router={router} />,
    }),
  )
}
```

<!-- ::end:framework -->

## Streaming Dehydration/Hydration

Streaming dehydration/hydration is an advanced pattern that goes beyond markup and allows you to dehydrate and stream any supporting data from the server to the client and rehydrate it on arrival. This is useful for applications that may need to further use/manage the underlying data that was used to render the initial markup on the server.

## Data Serialization

When using SSR, data passed between the server and the client must be serialized before it is sent across network-boundaries. TanStack Router handles this serialization using a very lightweight serializer that supports common data types beyond JSON.stringify/JSON.parse.

Out of the box, the following types are supported:

- `undefined`
- `Date`
- `Error`
- `FormData`

If you feel that there are other types that should be supported by default, please open an issue on the TanStack Router repository.

If you are using more complex data types like `Map`, `Set`, `BigInt`, etc, you may need to use a custom serializer to ensure that your type-definitions are accurate and your data is correctly serialized and deserialized. We are currently working on both a more robust serializer and a way to customize the serializer for your application. Open an issue if you are interested in helping out!
