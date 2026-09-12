---
id: build-from-scratch
title: Build a Project from Scratch
---

> [!NOTE]
> If you already created a project with the CLI or by cloning an example from the [Getting Started](./getting-started) guide, you can skip this guide and move on to the [Routing](./guide/routing) guide.

_So you want to build a TanStack Start project from scratch?_

This guide will help you build a **very** basic TanStack Start web application. Together, we will use TanStack Start to:

- Serve an index page
- Display a counter
- Increment the counter on the server and client

[Here is what that will look like](https://stackblitz.com/github/tanstack/router/tree/main/examples/react/start-counter)

Let's create a new project directory and initialize it.

```shell
mkdir myApp
cd myApp
npm init -y
```

> [!NOTE]
> We use `npm` in all of these examples, but you can use your package manager of choice instead.

## TypeScript Configuration

We highly recommend using TypeScript with TanStack Start. Create a `tsconfig.json` file with at least the following settings:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "skipLibCheck": true,
    "strictNullChecks": true
  }
}
```

> [!NOTE]
> Enabling `verbatimModuleSyntax` can result in server bundles leaking into client bundles. It is recommended to keep this option disabled.

## Install Dependencies

TanStack Start is powered by [TanStack Router](https://tanstack.com/router) and supports [Vite](https://vite.dev/) or [Rsbuild](https://rsbuild.dev/) as the build tool.

To install Start and Router, run:

```shell
npm i @tanstack/react-start @tanstack/react-router
```

You'll also need React:

```shell
npm i react react-dom
```

Install the build tool and React integration you want to use:

<!-- ::start:tabs variant="bundler" -->

# Vite

```shell
npm i -D vite @vitejs/plugin-react
```

# Rsbuild

```shell
npm i -D @rsbuild/core @rsbuild/plugin-react
```

<!-- ::end:tabs -->

If you use Vite, you can also use `@vitejs/plugin-react-swc` instead of `@vitejs/plugin-react`.

and some TypeScript:

```shell
npm i -D typescript @types/react @types/react-dom @types/node
```

## Update Configuration Files

We'll then update our `package.json` to use your build tool's CLI and set `"type": "module"`:

<!-- ::start:tabs variant="bundler" -->

# Vite

```json
{
  // ...
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build"
  }
}
```

# Rsbuild

```json
{
  // ...
  "type": "module",
  "scripts": {
    "dev": "rsbuild dev",
    "build": "rsbuild build"
  }
}
```

<!-- ::end:tabs -->

Then configure TanStack Start's build tool plugin:

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart(),
    // react's vite plugin must come after start's vite plugin
    viteReact(),
  ],
})
```

# Rsbuild

```ts title="rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [pluginReact(), tanstackStart()],
})
```

<!-- ::end:tabs -->

## Add the Basic Templating

There are 2 required files for TanStack Start usage:

1. The router configuration
2. The root of your application

Once configuration is done, we'll have a file tree that looks like the following:

```
.
├── src/
│   ├── routes/
│   │   └── `__root.tsx`
│   ├── `router.tsx`
│   ├── `routeTree.gen.ts`
├── `vite.config.ts` or `rsbuild.config.ts`
├── `package.json`
└── `tsconfig.json`
```

## The Router Configuration

This is the file that will dictate the behavior of TanStack Router used within Start. Here, you can configure everything
from the default [preloading functionality](/router/latest/docs/framework/react/guide/preloading) to [caching staleness](/router/latest/docs/framework/react/guide/data-loading).

> [!NOTE]
> You won't have a `routeTree.gen.ts` file yet. This file will be generated when you run TanStack Start for the first time.

```tsx
// src/router.tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  })

  return router
}
```

## The Root of Your Application

Finally, we need to create the root of our application. This is the entry point for all other routes. The code in this file will wrap all other routes in the application.

```tsx
// src/routes/__root.tsx
import type { ReactNode } from 'react'
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html>
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

## Writing Your First Route

Now that we have the basic templating setup, we can write our first route. This is done by creating a new file in the `src/routes` directory.

```tsx
// src/routes/index.tsx
import * as fs from 'node:fs'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

const filePath = 'count.txt'

async function readCount() {
  return parseInt(
    await fs.promises.readFile(filePath, 'utf-8').catch(() => '0'),
  )
}

const getCount = createServerFn({
  method: 'GET',
}).handler(() => {
  return readCount()
})

const updateCount = createServerFn({ method: 'POST' })
  .validator((d: number) => d)
  .handler(async ({ data }) => {
    const count = await readCount()
    await fs.promises.writeFile(filePath, `${count + data}`)
  })

export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => await getCount(),
})

function Home() {
  const router = useRouter()
  const state = Route.useLoaderData()

  return (
    <button
      type="button"
      onClick={() => {
        updateCount({ data: 1 }).then(() => {
          router.invalidate()
        })
      }}
    >
      Add 1 to {state}?
    </button>
  )
}
```

That's it! 🤯 You've now set up a TanStack Start project and written your first route. 🎉

You can now run `npm run dev` to start your server and navigate to `http://localhost:3000` to see your route in action.

You want to deploy your application? Check out the [hosting guide](./guide/hosting.md).
