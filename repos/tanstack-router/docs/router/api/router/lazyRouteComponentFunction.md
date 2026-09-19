---
id: lazyRouteComponentFunction
title: lazyRouteComponent function
---

> [!IMPORTANT]
> If you are using file-based routing, it's recommended to use the `createLazyFileRoute` function instead.

The `lazyRouteComponent` function can be used to create a one-off code-split route component that can be preloaded using a `component.preload()` method.

## lazyRouteComponent options

The `lazyRouteComponent` function accepts two arguments:

### `importer` option

- Type: `() => Promise<T>`
- Required
- A function that returns a promise that resolves to an object that contains the component to be loaded.

### `exportName` option

- Type: `string`
- Optional
- The name of the component to be loaded from the imported object. Defaults to `'default'`.

## lazyRouteComponent returns

- A `React.lazy` component that can be preloaded using a `component.preload()` method.

## Examples

```tsx
import { lazyRouteComponent } from '@tanstack/react-router'

const route = createRoute({
  path: '/posts/$postId',
  component: lazyRouteComponent(() => import('./Post')), // default export
})

// or

const route = createRoute({
  path: '/posts/$postId',
  component: lazyRouteComponent(
    () => import('./Post'),
    'PostByIdPageComponent', // named export
  ),
})
```
