---
id: migrate-from-next-js
title: Migrate from Next.js
---

This guide provides a step-by-step process to migrate a project from the Next.js App Router to **TanStack Start**. We respect the powerful features of Next.js and aim to make this transition as smooth as possible.

## Step-by-Step (Basics)

This step-by-step guide provides an overview of how to migrate your Next.js App Router project to TanStack Start. The goal is to help you understand the basic steps involved in the migration process so you can adapt them to your specific project needs.

### Prerequisites

Before we begin, this guide assumes your project structure looks like this:

```txt
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── public
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── README.md
├── src
│   └── app
│       ├── favicon.ico
│       ├── globals.css
│       ├── layout.tsx
│       └── page.tsx
└── tsconfig.json
```

Alternatively, you can follow along by cloning the following [starter template](https://github.com/nrjdalal/awesome-templates/tree/main/next.js-apps/next.js-start):

```sh
npx gitpick nrjdalal/awesome-templates/tree/main/next.js-apps/next.js-start next.js-start-er
```

This structure is a basic Next.js application using the App Router, which we will migrate to TanStack Start.

### 1. Remove Next.js

First, uninstall Next.js and remove related configuration files:

```sh
npm uninstall @tailwindcss/postcss next
rm postcss.config.* next.config.*
```

### 2. Install Required Dependencies

TanStack Start leverages TanStack Router and supports [Vite](https://vite.dev) or [Rsbuild](https://rsbuild.dev/) as the build tool. The Vite setup below includes [Nitro](https://nitro.build/) as a deployment plugin.

<!-- ::start:tabs variant="bundler" -->

# Vite

```sh
npm i @tanstack/react-router @tanstack/react-start nitro vite @vitejs/plugin-react
```

# Rsbuild

```sh
npm i @tanstack/react-router @tanstack/react-start @rsbuild/core @rsbuild/plugin-react
```

<!-- ::end:tabs -->

For Tailwind CSS, install the build tool integration you want to use:

<!-- ::start:tabs variant="bundler" -->

# Vite

```sh
npm i -D @tailwindcss/vite tailwindcss
```

# Rsbuild

```sh
npm i -D @tailwindcss/postcss tailwindcss
```

<!-- ::end:tabs -->

### 3. Update Project Configuration

Now that you've installed the necessary dependencies, update your project configuration files to work with TanStack Start.

<!-- ::start:tabs variant="bundler" -->

# Vite

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node .output/server/index.mjs"
  }
}
```

# Rsbuild

```json
{
  "type": "module",
  "scripts": {
    "dev": "rsbuild dev",
    "build": "rsbuild build"
  }
}
```

<!-- ::end:tabs -->

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  server: {
    port: 3000,
  },
  resolve: {
    // Enables Vite to resolve imports using path aliases.
    tsconfigPaths: true,
  },
  plugins: [
    tailwindcss(),
    tanstackStart({
      srcDirectory: 'src', // This is the default
      router: {
        // Specifies the directory TanStack Router uses for your routes.
        routesDirectory: 'app', // Defaults to "routes", relative to srcDirectory
      },
    }),
    viteReact(),
    nitro(),
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
  plugins: [
    pluginReact(),
    tanstackStart({
      srcDirectory: 'src', // This is the default
      router: {
        // Specifies the directory TanStack Router uses for your routes.
        routesDirectory: 'app', // Defaults to "routes", relative to srcDirectory
      },
    }),
  ],
})
```

```js title="postcss.config.mjs"
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

<!-- ::end:tabs -->

By default, `routesDirectory` is set to `routes`. To maintain consistency with Next.js App Router conventions, you can set it to `app` instead.

### 4. Adapt the Root Layout

> TanStack Start uses a routing approach similar to Remix, with some changes to support nested structures and special features using tokens. Learn more about it at [Routing Concepts](/router/latest/docs/framework/react/routing/routing-concepts) guide.

Instead of `layout.tsx`, create a file named `__root.tsx` in the `src/app` directory. This file will serve as the root layout for your application.

- `src/app/layout.tsx` to `src/app/__root.tsx`

```tsx
- import type { Metadata } from "next" // [!code --]
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router"
import appCss from "./globals.css?url"

- export const metadata: Metadata = { // [!code --]
-   title: "Create Next App", // [!code --]
-   description: "Generated by create next app", // [!code --]
- } // [!code --]
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "TanStack Start Starter" }
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  component: RootLayout,
})

- export default function RootLayout({ // [!code --]
-   children, // [!code --]
- }: Readonly<{ // [!code --]
-   children: React.ReactNode // [!code --]
- }>) { // [!code --]
-   return ( // [!code --]
-     <html lang="en"> // [!code --]
-       <body>{children}</body> // [!code --]
-     </html> // [!code --]
-   ) // [!code --]
- } // [!code --]
function RootLayout() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
```

### 5. Adapt the Home Page

Instead of `page.tsx`, create an `index.tsx` file for the `/` route.

- `src/app/page.tsx` to `src/app/index.tsx`

```tsx
+ import { createFileRoute } from '@tanstack/react-router' // [!code ++]

- export default function Home() { // [!code --]
+ export const Route = createFileRoute('/')({ // [!code ++]
+   component: Home, // [!code ++]
+ }) // [!code ++]

+ function Home() { // [!code ++]
  return (
    <main className="min-h-dvh w-screen flex items-center justify-center flex-col gap-y-4 p-4">
      <img
        className="max-w-sm w-full"
        src="https://raw.githubusercontent.com/TanStack/tanstack.com/main/public/images/logos/splash-dark.png"
        alt="TanStack Logo"
      />
      <h1>
        <span className="line-through">Next.js</span> TanStack Start
      </h1>
      <a
        className="bg-foreground text-background rounded-full px-4 py-1 hover:opacity-90"
        href="https://tanstack.com/start/latest"
        target="_blank"
      >
        Docs
      </a>
    </main>
  )
}
```

### 6. Are we migrated yet?

Before you can run the development server, you need to create a file that will define the behavior of TanStack Router within TanStack Start.

- `src/router.tsx`

```tsx
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

> 🧠 Here you can configure everything from the default [preloading functionality](/router/latest/docs/framework/react/guide/preloading) to [caching staleness](/router/latest/docs/framework/react/guide/data-loading).

Don't worry if you see some TypeScript errors at this point; the next step will resolve them.

### 7. Verify the Migration

Run the development server:

```sh
npm run dev
```

Then, visit `http://localhost:3000`. You should see the TanStack Start welcome page with its logo and a documentation link.

> If you encounter issues, review the steps above and ensure that file names and paths match exactly. For a reference implementation, see the [post-migration repository](https://github.com/nrjdalal/next-to-start).

## Next Steps (Advanced)

Now that you have migrated the basic structure of your Next.js application to TanStack Start, you can explore more advanced features and concepts.

### Routing Concepts

| Route Example                  | Next.js                            | TanStack Start            |
| ------------------------------ | ---------------------------------- | ------------------------- |
| Root Layout                    | `src/app/layout.tsx`               | `src/app/__root.tsx`      |
| `/` (Home Page)                | `src/app/page.tsx`                 | `src/app/index.tsx`       |
| `/posts` (Static Route)        | `src/app/posts/page.tsx`           | `src/app/posts.tsx`       |
| `/posts/[slug]` (Dynamic)      | `src/app/posts/[slug]/page.tsx`    | `src/app/posts/$slug.tsx` |
| `/posts/[...slug]` (Catch-All) | `src/app/posts/[...slug]/page.tsx` | `src/app/posts/$.tsx`     |
| `/api/endpoint` (API Route)    | `src/app/api/endpoint/route.ts`    | `src/app/api/endpoint.ts` |

Learn more about the [Routing Concepts](/router/latest/docs/framework/react/routing/routing-concepts).

### Dynamic and Catch-All Routes

Retrieving dynamic route parameters in TanStack Start is straightforward.

```tsx
- export default async function Page({ // [!code --]
-   params, // [!code --]
- }: { // [!code --]
-   params: Promise<{ slug: string }> // [!code --]
- }) { // [!code --]
+ export const Route = createFileRoute('/app/posts/$slug')({ // [!code ++]
+   component: Page, // [!code ++]
+ }) // [!code ++]

+ function Page() { // [!code ++]
-   const { slug } = await params // [!code --]
+   const { slug } = Route.useParams() // [!code ++]
  return <div>My Post: {slug}</div>
}
```

> Note: If you've made a catch-all route (like `src/app/posts/$.tsx`), you can access the parameters via `const { _splat } = Route.useParams()`.

Similarly, you can access `searchParams` using `const { page, filter, sort } = Route.useSearch()`.

Learn more about the [Dynamic and Catch-All Routes](/router/latest/docs/framework/react/routing/routing-concepts#dynamic-route-segments).

### Links

```tsx
- import Link from "next/link" // [!code --]
+ import { Link } from "@tanstack/react-router" // [!code ++]

function Component() {
-   return <Link href="/dashboard">Dashboard</Link> // [!code --]
+   return <Link to="/dashboard">Dashboard</Link> // [!code ++]
}
```

Learn more about the [Links](/router/latest/docs/framework/react/guide/navigation#link-component).

### Images

Next.js uses the `next/image` component for optimized images. In TanStack Start, you can use the package called [Unpic](https://unpic.pics/) for similar functionality
and almost a drop-in replacement.

```tsx
import Image from 'next/image' // [!code --]
import { Image } from '@unpic/react' // [!code ++]
function Component() {
  return (
    <Image
      src="/path/to/image.jpg"
      alt="Description"
      width="600" // [!code --]
      height="400" // [!code --]
      width={600} // [!code ++]
      height={400} // [!code ++]
    />
  )
}
```

### Server ~Actions~ Functions

```tsx
- 'use server' // [!code --]
+ import { createServerFn } from "@tanstack/react-start" // [!code ++]

- export const create = async () => { // [!code --]
+ export const create = createServerFn().handler(async () => { // [!code ++]
  return true
- } // [!code --]
+ }) // [!code ++]
```

Learn more about the [Server Functions](./guide/server-functions).

### Server Routes ~Handlers~

```ts
- export async function GET() { // [!code --]
+ export const Route = createFileRoute('/api/hello')({ // [!code ++]
+  server: { // [!code ++]
+     handlers: { // [!code ++]
+       GET: async () => { // [!code ++]
+         return Response.json("Hello, World!")
+       } // [!code ++]
+    } // [!code ++]
+  } // [!code ++]
+ }) // [!code ++]
```

Learn more about the [Server Routes](./guide/server-routes).

### Fonts

```tsx
- import { Inter } from "next/font/google" // [!code --]

- const inter = Inter({ // [!code --]
-   subsets: ["latin"], // [!code --]
-   display: "swap", // [!code --]
- }) // [!code --]

- export default function Page() { // [!code --]
-   return <p className={inter.className}>Font Sans</p> // [!code --]
- } // [!code --]
```

Instead of `next/font`, use Tailwind CSS’s CSS-first approach. Install fonts (for example, from [Fontsource](https://github.com/fontsource/fontsource)):

```sh
npm i -D @fontsource-variable/dm-sans @fontsource-variable/jetbrains-mono
```

Add the following to `src/app/globals.css`:

```css
@import 'tailwindcss' source('../');

@import '@fontsource-variable/dm-sans'; /* [!code ++] */
@import '@fontsource-variable/jetbrains-mono'; /* [!code ++] */

@theme inline {
  --font-sans: 'DM Sans Variable', sans-serif; /* [!code ++] */
  --font-mono: 'JetBrains Mono Variable', monospace; /* [!code ++] */
  /* ... */
}

/* ... */
```

### Fetching Data

```tsx
- export default async function Page() { // [!code --]
+ export const Route = createFileRoute('/')({ // [!code ++]
+   component: Page, // [!code ++]
+   loader: async () => { // [!code ++]
+     const res = await fetch('https://api.vercel.app/blog') // [!code ++]
+     return res.json() // [!code ++]
+   }, // [!code ++]
+ }) // [!code ++]

+ function Page() { // [!code ++]
-   const data = await fetch('https://api.vercel.app/blog') // [!code --]
-   const posts = await data.json() // [!code --]
+   const posts = Route.useLoaderData() // [!code ++]

  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  )
}
```
