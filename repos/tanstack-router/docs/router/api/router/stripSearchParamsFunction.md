---
id: stripSearchParams
title: Search middleware to strip search params
---

`stripSearchParams` is a search middleware that allows to remove search params.

## stripSearchParams props

`stripSearchParams` accepts one of the following inputs:

- `true`: if the search schema has no required params, `true` can be used to strip all search params
- a list of keys of those search params that shall be removed; only keys of optional search params are allowed.
- an object that conforms to the partial input search schema. The search params are compared against the values of this object; if the value is deeply equal, it will be removed. This is especially useful to strip out default search params.

## Examples

```tsx
import { z } from 'zod'
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

const defaultValues = {
  one: 'abc',
  two: 'xyz',
}

const searchSchema = z.object({
  one: z.string().default(defaultValues.one),
  two: z.string().default(defaultValues.two),
})

export const Route = createFileRoute('/')({
  // for Zod v4, use the schema directly
  validateSearch: searchSchema,
  search: {
    // strip default values
    middlewares: [stripSearchParams(defaultValues)],
  },
})
```

```tsx
import { z } from 'zod'
import { createRootRoute, stripSearchParams } from '@tanstack/react-router'

const searchSchema = z.object({
  hello: z.string().default('world'),
  requiredParam: z.string(),
})

export const Route = createRootRoute({
  // for Zod v4, use the schema directly
  validateSearch: searchSchema,
  search: {
    // always remove `hello`
    middlewares: [stripSearchParams(['hello'])],
  },
})
```

```tsx
import { z } from 'zod'
import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

const searchSchema = z.object({
  one: z.string().default('abc'),
  two: z.string().default('xyz'),
})

export const Route = createFileRoute('/')({
  // for Zod v4, use the schema directly
  validateSearch: searchSchema,
  search: {
    // remove all search params
    middlewares: [stripSearchParams(true)],
  },
})
```
