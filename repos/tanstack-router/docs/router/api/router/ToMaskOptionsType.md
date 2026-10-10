---
id: ToMaskOptionsType
title: ToMaskOptions type
---

The `ToMaskOptions` type includes the same destination fields as [`ToOptions`](./ToOptionsType.md), excluding `mask`, and adds options specific to route masking.

```tsx
type ToMaskOptions = {
  from?: ValidRoutePath | string
  to?: ValidRoutePath | string
  hash?: true | string | ((prev?: string) => string)
  state?: true | HistoryState | ((prev: HistoryState) => HistoryState)
} & SearchParamOptions &
  PathParamOptions & {
    unmaskOnReload?: boolean
  }
```

- [`ToOptions`](./ToOptionsType.md)
