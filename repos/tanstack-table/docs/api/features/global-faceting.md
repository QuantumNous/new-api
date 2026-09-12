---
title: Global Faceting APIs
id: global-faceting
---

## Table API

### `getGlobalFacetedRowModel`

```tsx
getGlobalFacetedRowModel: () => RowModel<TData>
```

Returns the faceted row model for the global filter.

### `getGlobalFacetedUniqueValues`

```tsx
getGlobalFacetedUniqueValues: () => Map<any, number>
```

Returns the faceted unique values for the global filter.

### `getGlobalFacetedMinMaxValues`

```tsx
getGlobalFacetedMinMaxValues: () => [number, number]
```

Returns the faceted min and max values for the global filter.
