---
id: ToOptionsType
title: ToOptions type
---

The `ToOptions` type contains several properties that can be used to describe a router destination, including `mask` for route masking.

```tsx
type ToOptions = {
  from?: ValidRoutePath | string
  to?: ValidRoutePath | string
  hash?: true | string | ((prev?: string) => string)
  state?: true | HistoryState | ((prev: HistoryState) => HistoryState)
} & SearchParamOptions &
  PathParamOptions &
  MaskOptions

type SearchParamOptions = {
  search?: true | TToSearch | ((prev: TFromSearch) => TToSearch)
}

type PathParamOptions = {
  params?:
    | true
    | Record<string, TPathParam>
    | ((prev: TFromParams) => TToParams)
}

type MaskOptions = {
  mask?: ToMaskOptions<TRouter, TMaskFrom, TMaskTo>
}
```
