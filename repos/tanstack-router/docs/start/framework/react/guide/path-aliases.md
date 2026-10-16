---
id: path-aliases
title: Path Aliases
---

Path aliases are a useful feature of TypeScript that allows you to define a shortcut for a path that could be distant in your project's directory structure. This can help you avoid long relative imports in your code and make it easier to refactor your project's structure. This is especially useful for avoiding long relative imports in your code.

By default, TanStack Start does not include path aliases. However, you can easily add them to your project by updating your `tsconfig.json` file in the root of your project and adding the following configuration:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "~/*": ["./src/*"]
    }
  }
}
```

In this example, we've defined the path alias `~/*` that maps to the `./src/*` directory. This means that you can now import files from the `src` directory using the `~` prefix.

After updating your `tsconfig.json` file, configure your build tool so it resolves the same path aliases.

<!-- ::start:tabs variant="bundler" -->

# Vite

## Vite 8

Vite 8+ has [built-in support for path aliases](https://vite.dev/config/shared-options#resolve-tsconfigpaths), which is disabled by default. To enable it, simply add the following configuration to your `vite.config.ts` file:

```ts
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    // This enables built-in support for path aliases defined in tsconfig.json
    tsconfigPaths: true,
  },
})
```

## Vite 7 and earlier

For Vite 7 and earlier, install the `vite-tsconfig-paths` plugin to enable path aliases in your TanStack Start project. You can do this by running the following command:

```sh
npm install -D vite-tsconfig-paths
```

Now, you'll need to update your `vite.config.ts` file to include the following:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
  ],
})
```

# Rsbuild

Rsbuild reads the `paths` field from `tsconfig.json` by default. No extra config is needed when your aliases live in the root `tsconfig.json`.

If you use a custom tsconfig file, point Rsbuild at it with `source.tsconfigPath`:

```ts
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core'

export default defineConfig({
  source: {
    tsconfigPath: './tsconfig.custom.json',
  },
})
```

<!-- ::end:tabs -->

Once this configuration has completed, you'll now be able to import files using the path alias like so:

```ts
// app/routes/posts/$postId/edit.tsx
import { Input } from '~/components/ui/input'

// instead of

import { Input } from '../../../components/ui/input'
```
