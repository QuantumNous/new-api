---
title: Manual Setup
---

To set up TanStack Router manually in a React project, follow the steps below. This gives you a bare minimum setup to get going with TanStack Router using both file-based route generation and code-based route configuration:

## Using File-Based Route Generation

#### Install TanStack Router, Vite Plugin, and the Router Devtools

Install the necessary core dependencies:

<!-- ::start:tabs variant="package-managers" -->

react: @tanstack/react-router @tanstack/react-router-devtools
solid: @tanstack/solid-router @tanstack/solid-router-devtools

<!-- ::end:tabs -->

Install the necessary development dependencies:

<!-- ::start:tabs variant="package-managers" mode="dev-install" -->

react: @tanstack/router-plugin
solid: @tanstack/router-plugin

<!-- ::end:tabs -->

#### Configure the Vite Plugin

```tsx
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Please make sure that '@tanstack/router-plugin' is passed before '@vitejs/plugin-react'
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    // ...,
  ],
})
```

> [!TIP]
> If you are not using Vite, or any of the supported bundlers, you can check out the [TanStack Router CLI](./with-router-cli) guide for more info.

Create the following files:

- `src/routes/__root.tsx` (with two '`_`' characters)
- `src/routes/index.tsx`
- `src/routes/about.tsx`
- `src/main.tsx`

<!-- ::start:framework -->

# React

<!-- ::start:tabs variant="files" -->

```tsx title="src/routes/__root.tsx"
import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

const RootLayout = () => (
  <>
    <div className="p-2 flex gap-2">
      <Link to="/" className="[&.active]:font-bold">
        Home
      </Link>{' '}
      <Link to="/about" className="[&.active]:font-bold">
        About
      </Link>
    </div>
    <hr />
    <Outlet />
    <TanStackRouterDevtools />
  </>
)

export const Route = createRootRoute({ component: RootLayout })
```

```tsx title="src/routes/index.tsx"
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div className="p-2">
      <h3>Welcome Home!</h3>
    </div>
  )
}
```

```tsx title="src/routes/about.tsx"
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return <div className="p-2">Hello from About!</div>
}
```

```tsx title="src/main.tsx"
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
```

<!-- ::end:tabs -->

# Solid

<!-- ::start:tabs variant="files" -->

```tsx title="src/routes/__root.tsx"
import { createRootRoute, Link, Outlet } from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'

const RootLayout = () => (
  <>
    <div class="p-2 flex gap-2">
      <Link to="/" class="[&.active]:font-bold">
        Home
      </Link>{' '}
      <Link to="/about" class="[&.active]:font-bold">
        About
      </Link>
    </div>
    <hr />
    <Outlet />
    <TanStackRouterDevtools />
  </>
)

export const Route = createRootRoute({ component: RootLayout })
```

```tsx title="src/routes/index.tsx"
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div class="p-2">
      <h3>Welcome Home!</h3>
    </div>
  )
}
```

```tsx title="src/routes/about.tsx"
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return <div class="p-2">Hello from About!</div>
}
```

```tsx title="src/main.tsx"
/* @refresh reload */
import { render } from 'solid-js/web'
import { RouterProvider, createRouter } from '@tanstack/solid-router'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a new router instance
const router = createRouter({ routeTree })

// Register the router instance for type safety
declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

// Render the app
const rootElement = document.getElementById('root')!

render(() => <RouterProvider router={router} />, rootElement)
```

<!-- ::end:tabs -->

<!-- ::end:framework -->

Regardless of whether you are using the `@tanstack/router-plugin` package and running the `npm run dev`/`npm run build` scripts, or manually running the `tsr watch`/`tsr generate` commands from your package scripts, the route tree file will be generated at `src/routeTree.gen.ts`.

If you are working with this pattern you should change the `id` of the root `<div>` on your `index.html` file to `<div id='root'></div>`

## Using Code-Based Route Configuration

> [!IMPORTANT]
> The following example shows how to configure routes using code, and for simplicity's sake is in a single file for this demo. While code-based generation allows you to declare many routes and even the router instance in a single file, we recommend splitting your routes into separate files for better organization and performance as your application grows.

<!-- ::start:framework -->

# React

```tsx
import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  Outlet,
  RouterProvider,
  Link,
  createRouter,
  createRoute,
  createRootRoute,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

const rootRoute = createRootRoute({
  component: () => (
    <>
      <div className="p-2 flex gap-2">
        <Link to="/" className="[&.active]:font-bold">
          Home
        </Link>{' '}
        <Link to="/about" className="[&.active]:font-bold">
          About
        </Link>
      </div>
      <hr />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function Index() {
    return (
      <div className="p-2">
        <h3>Welcome Home!</h3>
      </div>
    )
  },
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: function About() {
    return <div className="p-2">Hello from About!</div>
  },
})

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
```

# Solid

```tsx
/* @refresh reload */
import { render } from 'solid-js/web'
import {
  Outlet,
  RouterProvider,
  Link,
  createRouter,
  createRoute,
  createRootRoute,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'

const rootRoute = createRootRoute({
  component: () => (
    <>
      <div class="p-2 flex gap-2">
        <Link to="/" class="[&.active]:font-bold">
          Home
        </Link>{' '}
        <Link to="/about" class="[&.active]:font-bold">
          About
        </Link>
      </div>
      <hr />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function Index() {
    return (
      <div class="p-2">
        <h3>Welcome Home!</h3>
      </div>
    )
  },
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: function About() {
    return <div class="p-2">Hello from About!</div>
  },
})

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!
render(() => <RouterProvider router={router} />, rootElement)
```

<!-- ::end:framework -->

If you glossed over these examples or didn't understand something, we don't blame you, because there's so much more to learn to really take advantage of TanStack Router! Let's move on.
