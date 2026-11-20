---
title: Table APIs
---

## `createAngularTable` / `useReactTable` / `createSolidTable` / `useQwikTable` / `useVueTable` / `createSvelteTable`

```tsx
type useReactTable = <TData extends AnyData>(
  options: TableOptions<TData>
) => Table<TData>
```

These functions are used to create a table. Which one you use depends on which framework adapter you are using.

## Options

These are **core** options and API properties for the table. More options and API properties are available for other [table features](../guide/features).

### `data`

```tsx
data: TData[]
```

The data for the table to display. This array should match the type you provided to `table.setRowType<...>`, but in theory could be an array of anything. It's common for each item in the array to be an object of key/values but this is not required. Columns can access this data via string/index or a functional accessor to return anything they want.

When the `data` option changes reference (compared via `Object.is`), the table will reprocess the data. Any other data processing that relies on the core data model (such as grouping, sorting, filtering, etc) will also be reprocessed.

> 🧠 Make sure your `data` option is only changing when you want the table to reprocess. Providing an inline `[]` or constructing the data array as a new object every time you want to render the table will result in a _lot_ of unnecessary re-processing. This can easily go unnoticed in smaller tables, but you will likely notice it in larger tables.

### `columns`

```tsx
type columns = ColumnDef<TData>[]
```

The array of column defs to use for the table. See the [Column Defs Guide](../../docs/guide/column-defs) for more information on creating column definitions.

### `defaultColumn`

```tsx
defaultColumn?: Partial<ColumnDef<TData>>
```

Default column options to use for all column defs supplied to the table. This is useful for providing default cell/header/footer renderers, sorting/filtering/grouping options, etc. All column definitions passed to `options.columns` are merged with this default column definition to produce the final column definitions.

### `initialState`

```tsx
initialState?: Partial<
  VisibilityTableState &
  ColumnOrderTableState &
  ColumnPinningTableState &
  FiltersTableState &
  SortingTableState &
  ExpandedTableState &
  GroupingTableState &
  ColumnSizingTableState &
  PaginationTableState &
  RowSelectionTableState
>
```

Use this option to optionally pass initial state to the table. This state will be used when resetting various table states either automatically by the table (eg. `options.autoResetPageIndex`) or via functions like `table.resetRowSelection()`. Most reset function allow you optionally pass a flag to reset to a blank/default state instead of the initial state.

> 🧠 Table state will not be reset when this object changes, which also means that the initial state object does not need to be stable.

### `autoResetAll`

```tsx
autoResetAll?: boolean
```

Set this option to override any of the `autoReset...` feature options.

### `meta`

```tsx
meta?: TableMeta // This interface is extensible via declaration merging. See below!
```

You can pass any object to `options.meta` and access it anywhere the `table` is available via `table.options.meta` This type is global to all tables and can be extended like so:

```tsx
declare module '@tanstack/table-core' {
  interface TableMeta<TData extends RowData> {
    foo: string
  }
}
```

> 🧠 Think of this option as an arbitrary "context" for your table. This is a great way to pass arbitrary data or functions to your table without having to pass it to every thing the table touches. A good example is passing a locale object to your table to use for formatting dates, numbers, etc or even a function that can be used to update editable data like in the [editable-data example](../framework/react/examples/editable-data).

### `state`

```tsx
state?: Partial<
  VisibilityTableState &
  ColumnOrderTableState &
  ColumnPinningTableState &
  FiltersTableState &
  SortingTableState &
  ExpandedTableState &
  GroupingTableState &
  ColumnSizingTableState &
  PaginationTableState &
  RowSelectionTableState
>
```

The `state` option can be used to optionally _control_ part or all of the table state. The state you pass here will merge with and overwrite the internal automatically-managed state to produce the final state for the table. You can also listen to state changes via the `onStateChange` option.

### `onStateChange`

```tsx
onStateChange: (updater: Updater<TableState>) => void
```

The `onStateChange` option can be used to optionally listen to state changes within the table. If you provide this options, you will be responsible for controlling and updating the table state yourself. You can provide the state back to the table with the `state` option.

### `debugAll`

> ⚠️ Debugging is only available in development mode.

```tsx
debugAll?: boolean
```

Set this option to true to output all debugging information to the console.

### `debugTable`

> ⚠️ Debugging is only available in development mode.

```tsx
debugTable?: boolean
```

Set this option to true to output table debugging information to the console.

### `debugHeaders`

> ⚠️ Debugging is only available in development mode.

```tsx
debugHeaders?: boolean
```

Set this option to true to output header debugging information to the console.

### `debugColumns`

> ⚠️ Debugging is only available in development mode.

```tsx
debugColumns?: boolean
```

Set this option to true to output column debugging information to the console.

### `debugRows`

> ⚠️ Debugging is only available in development mode.

```tsx
debugRows?: boolean
```

Set this option to true to output row debugging information to the console.

### `_features`

```tsx
_features?: TableFeature[]
```

An array of extra features that you can add to the table instance.

### `render`

> ⚠️ This option is only necessary if you are implementing a table adapter.

```tsx
type render = <TProps>(template: Renderable<TProps>, props: TProps) => any
```

The `render` option provides a renderer implementation for the table. This implementation is used to turn a table's various column header and cell templates into a result that is supported by the user's framework.

### `mergeOptions`

> ⚠️ This option is only necessary if you are implementing a table adapter.

```tsx
type mergeOptions = <T>(defaultOptions: T, options: Partial<T>) => T
```

This option is used to optionally implement the merging of table options. Some framework like solid-js use proxies to track reactivity and usage, so merging reactive objects needs to be handled carefully. This option inverts control of this process to the adapter.

### `getCoreRowModel`

```tsx
getCoreRowModel: (table: Table<TData>) => () => RowModel<TData>
```

This required option is a factory for a function that computes and returns the core row model for the table. It is called **once** per table and should return a **new function** which will calculate and return the row model for the table.

A default implementation is provided via any table adapter's `{ getCoreRowModel }` export.

### `getSubRows`

```tsx
getSubRows?: (
  originalRow: TData,
  index: number
) => undefined | TData[]
```

This optional function is used to access the sub rows for any given row. If you are using nested rows, you will need to use this function to return the sub rows object (or undefined) from the row.

### `getRowId`

```tsx
getRowId?: (
  originalRow: TData,
  index: number,
  parent?: Row<TData>
) => string
```

This optional function is used to derive a unique ID for any given row. If not provided the rows index is used (nested rows join together with `.` using their grandparents' index eg. `index.index.index`). If you need to identify individual rows that are originating from any server-side operations, it's suggested you use this function to return an ID that makes sense regardless of network IO/ambiguity eg. a userId, taskId, database ID field, etc.

## Table API

These properties and methods are available on the table object:

### `initialState`

```tsx
initialState: VisibilityTableState &
  ColumnOrderTableState &
  ColumnPinningTableState &
  FiltersTableState &
  SortingTableState &
  ExpandedTableState &
  GroupingTableState &
  ColumnSizingTableState &
  PaginationTableState &
  RowSelectionTableState
```

This is the resolved initial state of the table.

### `reset`

```tsx
reset: () => void
```

Call this function to reset the table state to the initial state.

### `getState`

```tsx
getState: () => TableState
```

Call this function to get the table's current state. It's recommended to use this function and its state, especially when managing the table state manually. It is the exact same state used internally by the table for every feature and function it provides.

> 🧠 The state returned by this function is the shallow-merged result of the automatically-managed internal table-state and any manually-managed state passed via `options.state`.

### `setState`

```tsx
setState: (updater: Updater<TableState>) => void
```

Call this function to update the table state. It's recommended you pass an updater function in the form of `(prevState) => newState` to update the state, but a direct object can also be passed.

> 🧠 If `options.onStateChange` is provided, it will be triggered by this function with the new state.

### `options`

```tsx
options: TableOptions<TData>
```

A read-only reference to the table's current options.

> ⚠️ This property is generally used internally or by adapters. It can be updated by passing new options to your table. This is different per adapter. For adapters themselves, table options must be updated via the `setOptions` function.

### `setOptions`

```tsx
setOptions: (newOptions: Updater<TableOptions<TData>>) => void
```

> ⚠️ This function is generally used by adapters to update the table options. It can be used to update the table options directly, but it is generally not recommended to bypass your adapters strategy for updating table options.

### `getCoreRowModel`

```tsx
getCoreRowModel: () => {
  rows: Row<TData>[],
  flatRows: Row<TData>[],
  rowsById: Record<string, Row<TData>>,
}
```

Returns the core row model before any processing has been applied.

### `getRowModel`

```tsx
getRowModel: () => {
  rows: Row<TData>[],
  flatRows: Row<TData>[],
  rowsById: Record<string, Row<TData>>,
}
```

Returns the final model after all processing from other used features has been applied.

### `getAllColumns`

```tsx
type getAllColumns = () => Column<TData>[]
```

Returns all columns in the table in their normalized and nested hierarchy, mirrored from the column defs passed to the table.

### `getAllFlatColumns`

```tsx
type getAllFlatColumns = () => Column<TData>[]
```

Returns all columns in the table flattened to a single level. This includes parent column objects throughout the hierarchy.

### `getAllLeafColumns`

```tsx
type getAllLeafColumns = () => Column<TData>[]
```

Returns all leaf-node columns in the table flattened to a single level. This does not include parent columns.

### `getColumn`

```tsx
type getColumn = (id: string) => Column<TData> | undefined
```

Returns a single column by its ID.

### `getHeaderGroups`

```tsx
type getHeaderGroups = () => HeaderGroup<TData>[]
```

Returns the header groups for the table.

### `getFooterGroups`

```tsx
type getFooterGroups = () => HeaderGroup<TData>[]
```

Returns the footer groups for the table.

### `getFlatHeaders`

```tsx
type getFlatHeaders = () => Header<TData>[]
```

Returns a flattened array of Header objects for the table, including parent headers.

### `getLeafHeaders`

```tsx
type getLeafHeaders = () => Header<TData>[]
```

Returns a flattened array of leaf-node Header objects for the table.
