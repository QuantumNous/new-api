---
id: linkOptions
title: Link options
---

`linkOptions` is a function which type checks an object literal with the intention of being used for `Link`, `navigate` or `redirect`

## linkOptions props

The `linkOptions` accepts the following option:

### `...props`

- Type: `LinkProps & React.RefAttributes<HTMLAnchorElement>`
- [`LinkProps`](./LinkPropsType.md)

## `linkOptions` returns

An object literal with the exact type inferred from the input

## Examples

```tsx
const userLinkOptions = linkOptions({
  to: '/dashboard/users/user',
  search: {
    usersView: {
      sortBy: 'email',
      filterBy: 'filter',
    },
    userId: 0,
  },
})

function DashboardComponent() {
  return <Link {...userLinkOptions} />
}
```
