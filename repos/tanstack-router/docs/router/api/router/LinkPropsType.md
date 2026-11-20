---
id: LinkPropsType
title: LinkProps type
---

The `LinkProps` type extends the [`ActiveLinkOptions`](./ActiveLinkOptionsType.md) and `React.AnchorHTMLAttributes<HTMLAnchorElement>` types and contains additional props specific to the `Link` component.

```tsx
type LinkProps = ActiveLinkOptions &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> & {
    children?:
      | React.ReactNode
      | ((state: { isActive: boolean }) => React.ReactNode)
  }
```

## LinkProps properties

- All of the props from [`ActiveLinkOptions`](./ActiveLinkOptionsType.md)
- All of the props from `React.AnchorHTMLAttributes<HTMLAnchorElement>`

#### `children`

- Type: `React.ReactNode | ((state: { isActive: boolean }) => React.ReactNode)`
- Optional
- The children that will be rendered inside of the anchor element. If a function is provided, it will be called with an object that contains the `isActive` boolean value that can be used to determine if the link is active.
