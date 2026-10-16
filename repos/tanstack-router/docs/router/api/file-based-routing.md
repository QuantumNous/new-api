---
title: File-Based Routing API Reference
---

TanStack Router's file-based routing is quite flexible and can be configured to suit your project's needs.

## Configuration options

The following options are available for configuring the file-based routing:

- [`routesDirectory` (required)](#routesdirectory-required)
- [`generatedRouteTree` (required)](#generatedroutetree-required)
- [`virtualRouteConfig`](#virtualrouteconfig)
- [`routeFilePrefix`](#routefileprefix)
- [`routeFileIgnorePrefix`](#routefileignoreprefix)
- [`routeFileIgnorePattern`](#routefileignorepattern)
- [`indexToken`](#indextoken)
- [`routeToken`](#routetoken)
- [`quoteStyle`](#quotestyle)
- [`semicolons`](#semicolons)
- [`autoCodeSplitting`](#autocodesplitting)
- [`disableTypes`](#disabletypes)
- [`addExtensions`](#addextensions)
- [`disableLogging`](#disablelogging)
- [`routeTreeFileHeader`](#routetreefileheader)
- [`routeTreeFileFooter`](#routetreefilefooter)
- [`enableRouteTreeFormatting`](#enableroutetreeformatting)
- [`tmpDir`](#tmpdir)

> [!WARNING]
> Do not set the `routeFilePrefix`, `routeFileIgnorePrefix`, or `routeFileIgnorePattern` options, to match any of the tokens used in the **File Naming Conventions** guide, or you may run into unexpected behavior.

### `routesDirectory` (required)

This is the path to the directory where the route files are located, relative to the cwd (current working directory).

By default, the value is set to the following and cannot be set to an empty `string` or `undefined`.

```txt
./src/routes
```

### `generatedRouteTree` (required)

This is the path to the file where the generated route tree will be saved, relative to the cwd (current working directory).

By default, the value is set to the following and cannot be set to an empty `string` or `undefined`.

```txt
./src/routeTree.gen.ts
```

If the [`disableTypes`](#disabletypes) is set to `true`, the generated route tree will be saved with the `.js` extension instead of `.ts`.

### `virtualRouteConfig`

This option is used to configure the Virtual File Routes feature. See the "Virtual File Routes" guide for more information.

By default, this value is set to `undefined`.

### `routeFilePrefix`

This option is used to identify route files in the route directory. This means that only files that start with this prefix will be considered for routing.

By default, this value is set to `` and as such all files in the route directory will be considered for routing.

### `routeFileIgnorePrefix`

This option is used to ignore specific files and directories in the route directory. This can be useful if you want to "opt-in" certain files or directories that you do not want to be considered for routing.

By default, this value is set to `-`.

When using this option, it allows you have structures like this where it let's you co-located related files that are not route files:

```txt
src/routes
├── posts
│   ├── -components  // Ignored
│   │   ├── Post.tsx
│   ├── index.tsx
│   ├── route.tsx
```

### `routeFileIgnorePattern`

This option is used to ignore specific files and directories in the route directory. It can be used in regular expression format. For example, `.((css|const).ts)|test-page` will ignore files / directories with names containing `.css.ts`, `.const.ts` or `test-page`.

By default, this value is set to `undefined`.

### `routeToken`

As mentioned in the Routing Concepts guide, a layout route is rendered at the specified path, and the child routes are rendered within the layout route. The `routeToken` is used to identify the layout route file in the route directory.

By default, this value is set to `route`.

> 🧠 the following filenames would equal the same runtime URL:

```txt
src/routes/posts.tsx -> /posts
src/routes/posts.route.tsx -> /posts
src/routes/posts/route.tsx -> /posts
```

#### Using regex patterns for `routeToken`

You can use a regular expression pattern instead of a literal string to match multiple layout route naming conventions. This is useful when you want more flexibility in your file naming.

**In `tsr.config.json`** (JSON config), use an object with `regex` and optional `flags` properties:

```json
{
  "routeToken": { "regex": "[a-z]+-layout", "flags": "i" }
}
```

**In code** (inline config), you can use a native `RegExp`:

```ts
{
  routeToken: /[a-z]+-layout/i
}
```

With the regex pattern `[a-z]+-layout`, filenames like `dashboard.main-layout.tsx`, `posts.protected-layout.tsx`, or `admin.settings-layout.tsx` would all be recognized as layout routes.

> [!NOTE]
> The regex is matched against the **entire** final segment of the route path. For example, with `routeToken: { "regex": "[a-z]+-layout" }`:
>
> - `dashboard.main-layout.tsx` matches (`main-layout` is the full segment)
> - `dashboard.my-layout-extra.tsx` does NOT match (the segment is `my-layout-extra`, not just `my-layout`)

### `indexToken`

As mentioned in the Routing Concepts guide, an index route is a route that is matched when the URL path is exactly the same as the parent route. The `indexToken` is used to identify the index route file in the route directory.

By default, this value is set to `index`.

> 🧠 the following filenames would equal the same runtime URL:

```txt
src/routes/posts.index.tsx -> /posts/
src/routes/posts/index.tsx -> /posts/
```

#### Using regex patterns for `indexToken`

Similar to `routeToken`, you can use a regular expression pattern for `indexToken` to match multiple index route naming conventions.

**In `tsr.config.json`** (JSON config):

```json
{
  "indexToken": { "regex": "[a-z]+-page" }
}
```

**In code** (inline config):

```ts
{
  indexToken: /[a-z]+-page/
}
```

With the regex pattern `[a-z]+-page`, filenames like `home-page.tsx`, `posts.list-page.tsx`, or `dashboard.overview-page.tsx` would all be recognized as index routes.

#### Escaping regex tokens

When using regex tokens, you can still escape a segment to prevent it from being treated as a token by wrapping it in square brackets. For example, if your `indexToken` is `{ "regex": "[a-z]+-page" }` and you want a literal route segment called `home-page`, name your file `[home-page].tsx`.

### `quoteStyle`

When your generated route tree is generated and when you first create a new route, those files will be formatted with the quote style you specify here.

By default, this value is set to `single`.

> [!TIP]
> You should ignore the path of your generated route tree file from your linter and formatter to avoid conflicts.

### `semicolons`

When your generated route tree is generated and when you first create a new route, those files will be formatted with semicolons if this option is set to `true`.

By default, this value is set to `false`.

> [!TIP]
> You should ignore the path of your generated route tree file from your linter and formatter to avoid conflicts.

### `autoCodeSplitting`

This feature is only available if you are using the TanStack Router Bundler Plugin.

This option is used to enable automatic code-splitting for non-critical route configuration items. See the "Automatic Code-Splitting" guide for more information.

By default, this value is set to `false`.

> [!IMPORTANT]
> The next major release of TanStack Router (i.e. v2), will have this value defaulted to `true`.

### `disableTypes`

This option is used to disable generating types for the route tree.

If set to `true`, the generated route tree will not include any types and will be written as a `.js` file instead of a `.ts` file.

By default, this value is set to `false`.

### `addExtensions`

- Type: `boolean | string`
- Default: `false`

This option controls file extensions on import paths in the generated route tree.

- `false` — Extensions are stripped from import paths (e.g. `'./routes/posts'`)
- `true` — The original file extensions are kept (e.g. `'./routes/posts.tsx'`)
- `string` — The original extension is replaced with the provided one (e.g. `'js'` produces `'./routes/posts.js'`)

Passing a string is useful when your project uses ESM, since Node.js ESM requires `.js` extensions for imports even when the source files are `.ts` or `.tsx`.

```ts
// Example: replace .tsx/.ts extensions with .js in generated imports
TanStackRouterVite({
  addExtensions: 'js',
})
```

### `disableLogging`

This option turns off the console logging for the route generation process.

By default, this value is set to `false`.

### `routeTreeFileHeader`

This option let's you prepend content to the start of the generated route tree file.

By default, this value is set to:

```json
[
  "/* eslint-disable */",
  "// @ts-nocheck",
  "// noinspection JSUnusedGlobalSymbols"
]
```

### `routeTreeFileFooter`

This option let's you append content to the end of the generated route tree file.

By default, this value is set to:

```json
[]
```

### `enableRouteTreeFormatting`

This option turns on the formatting function on the generated route tree file, which can be time-consuming for large projects.

By default, this value is set to `true`.

### `tmpDir`

Atomic file writes (route files and the generated route tree file) are implemented by creating a temporary file first and then renaming it to their actual location.

This config option allows to configure the path of the temp directory that will be used for creating those temporary files.
If it is a relative path, it will be resolved to the current working directory.
If this value is not set, `process.env.TSR_TMP_DIR` will be used.
If `process.env.TSR_TMP_DIR` is not set, it will default to `.tanstack/tmp` relative to the current working directory.
