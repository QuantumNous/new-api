---
id: tailwind-integration
title: Tailwind CSS Integration
---

_So you want to use Tailwind CSS in your TanStack Start project?_

This guide will help you use Tailwind CSS in your TanStack Start project.

## Tailwind CSS Version 4 (Latest)

The latest version of Tailwind CSS is 4. And it has some configuration changes that majorly differ from Tailwind CSS Version 3. It's **easier and recommended** to set up Tailwind CSS Version 4 in a TanStack Start project with either Vite or Rsbuild.

### Install Tailwind CSS

Install Tailwind CSS and the integration for your build tool.

<!-- ::start:tabs variant="bundler" -->

# Vite

```shell
npm install tailwindcss @tailwindcss/vite
```

# Rsbuild

```shell
npm install tailwindcss @tailwindcss/postcss postcss
```

<!-- ::end:tabs -->

### Configure Tailwind CSS

Add Tailwind CSS to your build tool configuration.

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [tsConfigPaths(), tanstackStart(), viteReact(), tailwindcss()],
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

```js title="postcss.config.mjs"
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

<!-- ::end:tabs -->

### Import Tailwind in your CSS file

You need to create a CSS file to configure Tailwind CSS instead of the configuration file in version 4. You can do this by creating a `src/styles/app.css` file or name it whatever you want.

```css
/* src/styles/app.css */
@import 'tailwindcss' source('../');
```

## Import the CSS file in your `__root.tsx` file

Import the CSS file in your `__root.tsx` file.

<!-- ::start:tabs variant="bundler" -->

# Vite

Use the `?url` query and make sure to add the **triple slash** directive to the top of the file.

```tsx
// src/routes/__root.tsx
/// <reference types="vite/client" />
// other imports...

import appCss from '../styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      // your meta tags and site config
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
    // other head config
  }),
  component: RootComponent,
})
```

# Rsbuild

Use a side-effect import so Start can discover the generated stylesheet as a route asset.

```tsx
// src/routes/__root.tsx
import { createRootRoute } from '@tanstack/react-router'
import '../styles/app.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      // your meta tags and site config
    ],
    // other head config
  }),
  component: RootComponent,
})
```

<!-- ::end:tabs -->

## Use Tailwind CSS anywhere in your project

You can now use Tailwind CSS anywhere in your project.

```tsx
// src/routes/index.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return <div className="bg-red-500 text-white p-4">Hello World</div>
}
```

That's it! You can now use Tailwind CSS anywhere in your project 🎉.

## Tailwind CSS Version 3 (Legacy)

If you are want to use Tailwind CSS Version 3, you can use the following steps.

### Install Tailwind CSS

Install Tailwind CSS and it's peer dependencies.

```shell
npm install -D tailwindcss@3 postcss autoprefixer
```

Then generate the Tailwind and PostCSS configuration files.

```shell
npx tailwindcss init -p
```

### Configure your template paths

Add the paths to all of your template files in the `tailwind.config.js` file.

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### Add the Tailwind directives to your CSS file

Add the `@tailwind` directives for each of Tailwind's layers to your `src/styles/app.css` file.

```css
/* src/styles/app.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

> [!NOTE]
> Jump to [Import the CSS file in your `__root.tsx` file](#import-the-css-file-in-your-__roottsx-file) to see how to import the CSS file in your `__root.tsx` file.
