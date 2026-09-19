---
title: Header APIs
---

These are **core** options and API properties for all headers. More options and API properties may be available for other [table features](../guide/features).

## Header API

All header objects have the following properties:

### `id`

```tsx
id: string
```

The unique identifier for the header.

### `index`

```tsx
index: number
```

The index for the header within the header group.

### `depth`

```tsx
depth: number
```

The depth of the header, zero-indexed based.

### `column`

```tsx
column: Column<TData>
```

The header's associated [Column](../api/core/column) object

### `headerGroup`

```tsx
headerGroup: HeaderGroup<TData>
```

The header's associated [HeaderGroup](../api/core/header-group) object

### `subHeaders`

```tsx
type subHeaders = Header<TData>[]
```

The header's hierarchical sub/child headers. Will be empty if the header's associated column is a leaf-column.

### `colSpan`

```tsx
colSpan: number
```

The col-span for the header.

### `rowSpan`

```tsx
rowSpan: number
```

The row-span for the header.

### `getLeafHeaders`

```tsx
type getLeafHeaders = () => Header<TData>[]
```

Returns the leaf headers hierarchically nested under this header.

### `isPlaceholder`

```tsx
isPlaceholder: boolean
```

A boolean denoting if the header is a placeholder header

### `placeholderId`

```tsx
placeholderId?: string
```

If the header is a placeholder header, this will be a unique header ID that does not conflict with any other headers across the table

### `getContext`

```tsx
getContext: () => {
  table: Table<TData>
  header: Header<TData, TValue>
  column: Column<TData, TValue>
}
```

Returns the rendering context (or props) for column-based components like headers, footers and filters. Use these props with your framework's `flexRender` utility to render these using the template of your choice:

```tsx
flexRender(header.column.columnDef.header, header.getContext())
```

## Table API

### `getHeaderGroups`

```tsx
type getHeaderGroups = () => HeaderGroup<TData>[]
```

Returns all header groups for the table.

### `getLeftHeaderGroups`

```tsx
type getLeftHeaderGroups = () => HeaderGroup<TData>[]
```

If pinning, returns the header groups for the left pinned columns.

### `getCenterHeaderGroups`

```tsx
type getCenterHeaderGroups = () => HeaderGroup<TData>[]
```

If pinning, returns the header groups for columns that are not pinned.

### `getRightHeaderGroups`

```tsx
type getRightHeaderGroups = () => HeaderGroup<TData>[]
```

If pinning, returns the header groups for the right pinned columns.

### `getFooterGroups`

```tsx
type getFooterGroups = () => HeaderGroup<TData>[]
```

Returns all footer groups for the table.

### `getLeftFooterGroups`

```tsx
type getLeftFooterGroups = () => HeaderGroup<TData>[]
```

If pinning, returns the footer groups for the left pinned columns.

### `getCenterFooterGroups`

```tsx
type getCenterFooterGroups = () => HeaderGroup<TData>[]
```

If pinning, returns the footer groups for columns that are not pinned.

### `getRightFooterGroups`

```tsx
type getRightFooterGroups = () => HeaderGroup<TData>[]
```

If pinning, returns the footer groups for the right pinned columns.

### `getFlatHeaders`

```tsx
type getFlatHeaders = () => Header<TData, unknown>[]
```

Returns headers for all columns in the table, including parent headers.

### `getLeftFlatHeaders`

```tsx
type getLeftFlatHeaders = () => Header<TData, unknown>[]
```

If pinning, returns headers for all left pinned columns in the table, including parent headers.

### `getCenterFlatHeaders`

```tsx
type getCenterFlatHeaders = () => Header<TData, unknown>[]
```

If pinning, returns headers for all columns that are not pinned, including parent headers.

### `getRightFlatHeaders`

```tsx
type getRightFlatHeaders = () => Header<TData, unknown>[]
```

If pinning, returns headers for all right pinned columns in the table, including parent headers.

### `getLeafHeaders`

```tsx
type getLeafHeaders = () => Header<TData, unknown>[]
```

Returns headers for all leaf columns in the table, (not including parent headers).

### `getLeftLeafHeaders`

```tsx
type getLeftLeafHeaders = () => Header<TData, unknown>[]
```

If pinning, returns headers for all left pinned leaf columns in the table, (not including parent headers).

### `getCenterLeafHeaders`

```tsx
type getCenterLeafHeaders = () => Header<TData, unknown>[]
```

If pinning, returns headers for all columns that are not pinned, (not including parent headers).

### `getRightLeafHeaders`

```tsx
type getRightLeafHeaders = () => Header<TData, unknown>[]
```

If pinning, returns headers for all right pinned leaf columns in the table, (not including parent headers).
