---
id: linkComponent
title: Link component
---

The `Link` component is a component that can be used to create a link that can be used to navigate to a new location. This includes changes to the pathname, search params, hash, and location state.

## Link props

The `Link` component accepts the following props:

### `...props`

- Type: `LinkProps & React.RefAttributes<HTMLAnchorElement>`
- [`LinkProps`](./LinkPropsType.md)

## Link returns

An anchor element that can be used to navigate to a new location.

## Examples

```tsx
import { Link } from '@tanstack/react-router'

function Component() {
  return (
    <Link
      to="/somewhere/$somewhereId"
      params={{ somewhereId: 'baz' }}
      search={(prev) => ({ ...prev, foo: 'bar' })}
    >
      Click me
    </Link>
  )
}
```

By default, param values with characters such as `@` will be encoded in the URL:

```tsx
// url path will be `/%40foo`
<Link to="/$username" params={{ username: '@foo' }} />
```

To opt-out, update the [pathParamsAllowedCharacters](../router/RouterOptionsType#pathparamsallowedcharacters-property) config on the router

```tsx
import { createRouter } from '@tanstack/react-router'

const router = createRouter({
  routeTree,
  pathParamsAllowedCharacters: ['@'],
})
```
