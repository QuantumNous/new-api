---
title: Installation with Router CLI
---

> [!WARNING]
> You should only use the TanStack Router CLI if you are not using a supported bundler. The CLI only supports the generation of the route tree file and does not provide any other features.

To use file-based routing with the TanStack Router CLI, you'll need to install the `@tanstack/router-cli` package.

<!-- ::start:tabs variant="package-manager" mode="dev-install" -->

react: @tanstack/router-cli
solid: @tanstack/router-cli

<!-- ::end:tabs -->

Once installed, you'll need to amend your scripts in your `package.json` for the CLI to `watch` and `generate` files.

```json
{
  "scripts": {
    "generate-routes": "tsr generate",
    "watch-routes": "tsr watch",
    "build": "npm run generate-routes && ...",
    "dev": "npm run watch-routes && ..."
  }
}
```

<!-- ::start:framework -->

# Solid

If you are using TypeScript, you should also add the following options to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "solid-js"
  }
}
```

With that, you're all set to start using file-based routing with TanStack Router.

<!-- ::end:framework -->

[//]: # 'AfterScripts'
[//]: # 'AfterScripts'

You shouldn't forget to _ignore_ the generated route tree file. Head over to the [Ignoring the generated route tree file](#ignoring-the-generated-route-tree-file) section to learn more.

With the CLI installed, the following commands are made available via the `tsr` command

## Using the `generate` command

Generates the routes for a project based on the provided configuration.

```sh
tsr generate
```

## Using the `watch` command

Continuously watches the specified directories and regenerates routes as needed.

**Usage:**

```sh
tsr watch
```

With file-based routing enabled, whenever you start your application in development mode, TanStack Router will watch your configured `routesDirectory` and generate your route tree whenever a file is added, removed, or changed.

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

When using the TanStack Router CLI for File-based routing, it comes with some sane defaults that should work for most projects:

<!-- ::start:framework -->

# React

```json
{
  "routesDirectory": "./src/routes",
  "generatedRouteTree": "./src/routeTree.gen.ts",
  "routeFileIgnorePrefix": "-",
  "quoteStyle": "single",
  "target": "react"
}
```

# Solid

```json
{
  "routesDirectory": "./src/routes",
  "generatedRouteTree": "./src/routeTree.gen.ts",
  "routeFileIgnorePrefix": "-",
  "quoteStyle": "single",
  "target": "solid"
}
```

<!-- ::end:framework -->

If these defaults work for your project, you don't need to configure anything at all! However, if you need to customize the configuration, you can do so by creating a `tsr.config.json` file in the root of your project directory.

You can find all the available configuration options in the [File-based Routing API Reference](../api/file-based-routing.md).
