---
title: HeaderGroup APIs
---

These are **core** options and API properties for all header groups. More options and API properties may be available for other [table features](../guide/features).

## Header Group API

All header group objects have the following properties:

### `id`

```tsx
id: string
```

The unique identifier for the header group.

### `depth`

```tsx
depth: number
```

The depth of the header group, zero-indexed based.

### `headers`

```tsx
type headers = Header<TData>[]
```

An array of [Header](../api/core/header) objects that belong to this header group
