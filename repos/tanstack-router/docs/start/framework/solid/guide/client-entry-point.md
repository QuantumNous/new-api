---
id: client-entry-point
title: Client Entry Point
---

# Client Entry Point

> [!NOTE]
> The client entry point is **optional** out of the box. If not provided, TanStack Start will automatically handle the client entry point for you using the below as a default.

Getting our html to the client is only half the battle. Once there, we need to hydrate our client-side JavaScript once the route resolves to the client. We do this by hydrating the root of our application with the `StartClient` component:

```tsx
// src/client.tsx
import { hydrate } from 'solid-js/web'
import { StartClient, hydrateStart } from '@tanstack/solid-start/client'

hydrateStart().then((router) => {
  hydrate(() => <StartClient router={router} />, document)
})
```

This enables us to kick off client-side routing once the user's initial server request has fulfilled.

## Error Handling

You can wrap your client entry point with error boundaries to handle client-side errors gracefully:

```tsx
// src/client.tsx
import { StartClient } from '@tanstack/solid-start/client'
import { hydrate } from 'solid-js/web'
import { ErrorBoundary } from './components/ErrorBoundary'

hydrate(
  () => (
    <ErrorBoundary>
      <StartClient />
    </ErrorBoundary>
  ),
  document.body,
)
```

## Development vs Production

You may want different behavior in development vs production:

```tsx
// src/client.tsx
import { StartClient } from '@tanstack/solid-start/client'
import { hydrate } from 'solid-js/web'

const App = (
  <>
    {import.meta.env.DEV && <div>Development Mode</div>}
    <StartClient />
  </>
)

hydrate(() => <App />, document.body)
```

The client entry point gives you full control over how your application initializes on the client side while working seamlessly with TanStack Start's server-side rendering.
