---
title: Installation with Esbuild
---

To use file-based routing with **Esbuild**, you'll need to install the `@tanstack/router-plugin` package.

<!-- ::start:tabs variant="package-manager" mode="dev-install" -->

react: @tanstack/router-plugin
solid: @tanstack/router-plugin

<!-- ::end:tabs -->

Once installed, you'll need to add the plugin to your configuration.

<!-- ::start:framework -->

# React

```ts title="esbuild.config.js"
import { tanstackRouter } from '@tanstack/router-plugin/esbuild'

export default {
  // ...
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
  ],
}
```

Or, you can clone our [Quickstart Esbuild example](https://github.com/TanStack/router/tree/main/examples/react/quickstart-esbuild-file-based) and get started.

# Solid

```ts title="build.js"
import * as esbuild from 'esbuild'
import { solidPlugin } from 'esbuild-plugin-solid'
import { tanstackRouter } from '@tanstack/router-plugin/esbuild'

const isDev = process.argv.includes('--dev')

const ctx = await esbuild.context({
  entryPoints: ['src/main.tsx'],
  outfile: 'dist/main.js',
  minify: !isDev,
  bundle: true,
  format: 'esm',
  target: ['esnext'],
  sourcemap: true,
  plugins: [
    solidPlugin(),
    tanstackRouter({ target: 'solid', autoCodeSplitting: true }),
  ],
})

if (isDev) {
  await ctx.watch()
  const { host, port } = await ctx.serve({ servedir: '.', port: 3005 })
  console.log(`Server running at http://${host || 'localhost'}:${port}`)
} else {
  await ctx.rebuild()
  await ctx.dispose()
}
```

Or, you can clone our [Quickstart Esbuild example](https://github.com/TanStack/router/tree/main/examples/solid/quickstart-esbuild-file-based) and get started.

<!-- ::end:framework -->

Now that you've added the plugin to your Esbuild configuration, you're all set to start using file-based routing with TanStack Router.

## Ignoring the generated route tree file

If your project is configured to use a linter and/or formatter, you may want to ignore the generated route tree file. This file is managed by TanStack Router and therefore shouldn't be changed by your linter or formatter.

Here are some resources to help you ignore the generated route tree file:

- Prettier - [https://prettier.io/docs/en/ignore.html#ignoring-files-prettierignore](https://prettier.io/docs/en/ignore.html#ignoring-files-prettierignore)
- ESLint - [https://eslint.org/docs/latest/use/configure/ignore#ignoring-files](https://eslint.org/docs/latest/use/configure/ignore#ignoring-files)
- Biome - [https://biomejs.dev/reference/configuration/#filesignore](https://biomejs.dev/reference/configuration/#filesignore)

> [!WARNING]
> If you are using VSCode, you may experience the route tree file unexpectedly open (with errors) after renaming a route.

You can prevent that from the VSCode settings by marking the file as readonly. Our recommendation is to also exclude it from search results and file watcher with the following settings:

```json
{
  "files.readonlyInclude": {
    "**/routeTree.gen.ts": true
  },
  "files.watcherExclude": {
    "**/routeTree.gen.ts": true
  },
  "search.exclude": {
    "**/routeTree.gen.ts": true
  }
}
```

You can use those settings either at a user level or only for a single workspace by creating the file `.vscode/settings.json` at the root of your project.

## Configuration

When using the TanStack Router Plugin with Esbuild for File-based routing, it comes with some sane defaults that should work for most projects:

```json
{
  "routesDirectory": "./src/routes",
  "generatedRouteTree": "./src/routeTree.gen.ts",
  "routeFileIgnorePrefix": "-",
  "quoteStyle": "single"
}
```

If these defaults work for your project, you don't need to configure anything at all! However, if you need to customize the configuration, you can do so by editing the configuration object passed into the `tanstackRouter` function.

You can find all the available configuration options in the [File-based Routing API Reference](../api/file-based-routing.md).
