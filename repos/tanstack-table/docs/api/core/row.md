---
title: Row APIs
---

These are **core** options and API properties for all rows. More options and API properties are available for other [table features](../guide/features).

## Row API

All row objects have the following properties:

### `id`

```tsx
id: string
```

The resolved unique identifier for the row resolved via the `options.getRowId` option. Defaults to the row's index (or relative index if it is a subRow)

### `depth`

```tsx
depth: number
```

The depth of the row (if nested or grouped) relative to the root row array.

### `index`

```tsx
index: number
```

The index of the row within its parent array (or the root data array)

### `original`

```tsx
original: TData
```

The original row object provided to the table.

> 🧠 If the row is a grouped row, the original row object will be the first original in the group.

### `parentId`

```tsx
parentId?: string
```

If nested, this row's parent row id.

### `getValue`

```tsx
getValue: (columnId: string) => TValue
```

Returns the value from the row for a given columnId

### `renderValue`

```tsx
renderValue: (columnId: string) => TValue
```

Renders the value from the row for a given columnId, but will return the `renderFallbackValue` if no value is found.

### `getUniqueValues`

```tsx
getUniqueValues: (columnId: string) => TValue[]
```

Returns a unique array of values from the row for a given columnId.

### `subRows`

```tsx
type subRows = Row<TData>[]
```

An array of subRows for the row as returned and created by the `options.getSubRows` option.

### `getParentRow`

```tsx
type getParentRow = () => Row<TData> | undefined
```

Returns the parent row for the row, if it exists.

### `getParentRows`

```tsx
type getParentRows = () => Row<TData>[]
```

Returns the parent rows for the row, all the way up to a root row.

### `getLeafRows`

```tsx
type getLeafRows = () => Row<TData>[]
```

Returns the leaf rows for the row, not including any parent rows.

### `originalSubRows`

```tsx
originalSubRows?: TData[]
```

An array of the original subRows as returned by the `options.getSubRows` option.

### `getAllCells`

```tsx
type getAllCells = () => Cell<TData>[]
```

Returns all of the [Cells](../api/core/cell) for the row.
