---
title: Column Filtering Guide
---

## Examples

Want to skip to the implementation? Check out these examples:

- [Column Filters](../framework/react/examples/filters)
- [Faceted Filters](../framework/react/examples/filters-faceted) (Autocomplete and Range filters)
- [Fuzzy Search](../framework/react/examples/filters-fuzzy) (Match Sorter)
- [Editable Data](../framework/react/examples/editable-data)
- [Expanding](../framework/react/examples/expanding) (Filtering from Sub-Rows)
- [Grouping](../framework/react/examples/grouping)
- [Pagination](../framework/react/examples/pagination)
- [Row Selection](../framework/react/examples/row-selection)

## API

[Column Filtering API](../api/features/column-filtering)

## Column Filtering Guide

Filtering comes in 2 flavors: Column Filtering and Global Filtering.

This guide will focus on column filtering, which is a filter that is applied to a single column's accessor value.

TanStack table supports both client-side and manual server-side filtering. This guide will go over how to implement and customize both, and help you decide which one is best for your use-case.

### Client-Side vs Server-Side Filtering

If you have a large dataset, you may not want to load all of that data into the client's browser in order to filter it. In this case, you will most likely want to implement server-side filtering, sorting, pagination, etc. 

However, as also discussed in the [Pagination Guide](../guide/pagination#should-you-use-client-side-pagination), a lot of developers underestimate how many rows can be loaded client-side without a performance hit. The TanStack table examples are often tested to handle up to 100,000 rows or more with decent performance for client-side filtering, sorting, pagination, and grouping. This doesn't necessarily mean that your app will be able to handle that many rows, but if your table is only going to have a few thousand rows at most, you might be able to take advantage of the client-side filtering, sorting, pagination, and grouping that TanStack table provides.

> TanStack Table can handle thousands of client-side rows with good performance. Don't rule out client-side filtering, pagination, sorting, etc. without some thought first.

Every use-case is different and will depend on the complexity of the table, how many columns you have, how large every piece of data is, etc. The main bottlenecks to pay attention to are:

1. Can your server query all of the data in a reasonable amount of time (and cost)?
2. What is the total size of the fetch? (This might not scale as badly as you think if you don't have many columns.)
3. Is the client's browser using too much memory if all of the data is loaded at once?

If you're not sure, you can always start with client-side filtering and pagination and then switch to server-side strategies in the future as your data grows.

### Manual Server-Side Filtering

If you have decided that you need to implement server-side filtering instead of using the built-in client-side filtering, here's how you do that.

No `getFilteredRowModel` table option is needed for manual server-side filtering. Instead, the `data` that you pass to the table should already be filtered. However, if you have passed a `getFilteredRowModel` table option, you can tell the table to skip it by setting the `manualFiltering` option to `true`.

```jsx
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  // getFilteredRowModel: getFilteredRowModel(), // not needed for manual server-side filtering
  manualFiltering: true,
})
```

> **Note:** When using manual filtering, many of the options that are discussed in the rest of this guide will have no effect. When `manualFiltering` is set to `true`, the table instance will not apply any filtering logic to the rows that are passed to it. Instead, it will assume that the rows are already filtered and will use the `data` that you pass to it as-is.

### Client-Side Filtering

If you are using the built-in client-side filtering features, first you need to pass in a `getFilteredRowModel` function to the table options. This function will be called whenever the table needs to filter the data. You can either import the default `getFilteredRowModel` function from TanStack Table or create your own.

```jsx
import { useReactTable, getFilteredRowModel } from '@tanstack/react-table'
//...
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(), // needed for client-side filtering
})
```

### Column Filter State

Whether or not you use client-side or server-side filtering, you can take advantage of the built-in column filter state management that TanStack Table provides. There are many table and column APIs to mutate and interact with the filter state and retrieving the column filter state.

The column filtering state is defined as an array of objects with the following shape:

```ts
interface ColumnFilter {
  id: string
  value: unknown
}
type ColumnFiltersState = ColumnFilter[]
```

Since the column filter state is an array of objects, you can have multiple column filters applied at once.

#### Accessing Column Filter State

You can access the column filter state from the table instance just like any other table state using the `table.getState()` API.

```jsx
const table = useReactTable({
  columns,
  data,
  //...
})

console.log(table.getState().columnFilters) // access the column filters state from the table instance
```

However, if you need to access the column filter state before the table is initialized, you can "control" the column filter state like down below.

### Controlled Column Filter State

If you need easy access to the column filter state, you can control/manage the column filter state in your own state management with the `state.columnFilters` and `onColumnFiltersChange` table options.

```tsx
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]) // can set initial column filter state here
//...
const table = useReactTable({
  columns,
  data,
  //...
  state: {
    columnFilters,
  },
  onColumnFiltersChange: setColumnFilters,
})
```

#### Initial Column Filter State

If you do not need to control the column filter state in your own state management or scope, but you still want to set an initial column filter state, you can use the `initialState` table option instead of `state`.

```jsx
const table = useReactTable({
  columns,
  data,
  //...
  initialState: {
    columnFilters: [
      {
        id: 'name',
        value: 'John', // filter the name column by 'John' by default
      },
    ],
  },
})
```

> **NOTE**: Do not use both `initialState.columnFilters` and `state.columnFilters` at the same time, as the initialized state in the `state.columnFilters` will override the `initialState.columnFilters`.

### FilterFns

Each column can have its own unique filtering logic. Choose from any of the filter functions that are provided by TanStack Table, or create your own.

By default there are 10 built-in filter functions to choose from:

- `includesString` - Case-insensitive string inclusion
- `includesStringSensitive` - Case-sensitive string inclusion
- `equalsString` - Case-insensitive string equality
- `equalsStringSensitive` - Case-sensitive string equality
- `arrIncludes` - Item inclusion within an array
- `arrIncludesAll` - All items included in an array
- `arrIncludesSome` - Some items included in an array
- `equals` - Object/referential equality `Object.is`/`===`
- `weakEquals` - Weak object/referential equality `==`
- `inNumberRange` - Number range inclusion

You can also define your own custom filter functions either as the `filterFn` column option, or as a global filter function using the `filterFns` table option.

#### Custom Filter Functions

> **Note:** These filter functions only run during client-side filtering.

When defining a custom filter function in either the `filterFn` column option or the `filterFns` table option, it should have the following signature:

```ts
const myCustomFilterFn: FilterFn = (row: Row, columnId: string, filterValue: any, addMeta: (meta: any) => void) => boolean
```

Every filter function receives:

- The row to filter
- The columnId to use to retrieve the row's value
- The filter value

and should return `true` if the row should be included in the filtered rows, and `false` if it should be removed.

```jsx
const columns = [
  {
    header: () => 'Name',
    accessorKey: 'name',
    filterFn: 'includesString', // use built-in filter function
  },
  {
    header: () => 'Age',
    accessorKey: 'age',
    filterFn: 'inNumberRange',
  },
  {
    header: () => 'Birthday',
    accessorKey: 'birthday',
    filterFn: 'myCustomFilterFn', // use custom global filter function
  },
  {
    header: () => 'Profile',
    accessorKey: 'profile',
    // use custom filter function directly
    filterFn: (row, columnId, filterValue) => {
      return // true or false based on your custom logic
    },
  }
]
//...
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  filterFns: { // add a custom global filter function
    myCustomFilterFn: (row, columnId, filterValue) => { // defined inline here
      return // true or false based on your custom logic
    },
    startsWith: startsWithFilterFn, // defined elsewhere
  },
})
```

##### Customize Filter Function Behavior

You can attach a few other properties to filter functions to customize their behavior:

- `filterFn.resolveFilterValue` - This optional "hanging" method on any given `filterFn` allows the filter function to transform/sanitize/format the filter value before it is passed to the filter function.

- `filterFn.autoRemove` - This optional "hanging" method on any given `filterFn` is passed a filter value and expected to return `true` if the filter value should be removed from the filter state. eg. Some boolean-style filters may want to remove the filter value from the table state if the filter value is set to `false`.

```tsx
const startsWithFilterFn = <TData extends MRT_RowData>(
  row: Row<TData>,
  columnId: string,
  filterValue: number | string, //resolveFilterValue will transform this to a string
) =>
  row
    .getValue<number | string>(columnId)
    .toString()
    .toLowerCase()
    .trim()
    .startsWith(filterValue); // toString, toLowerCase, and trim the filter value in `resolveFilterValue`

// remove the filter value from filter state if it is falsy (empty string in this case)
startsWithFilterFn.autoRemove = (val: any) => !val; 

// transform/sanitize/format the filter value before it is passed to the filter function
startsWithFilterFn.resolveFilterValue = (val: any) => val.toString().toLowerCase().trim(); 
```

### Customize Column Filtering

There are a lot of table and column options that you can use to further customize the column filtering behavior.

#### Disable Column Filtering

By default, column filtering is enabled for all columns. You can disable the column filtering for all columns or for specific columns by using the `enableColumnFilters` table option or the `enableColumnFilter` column option. You can also turn off both column and global filtering by setting the `enableFilters` table option to `false`.

Disabling column filtering for a column will cause the `column.getCanFilter` API to return `false` for that column.

```jsx
const columns = [
  {
    header: () => 'Id',
    accessorKey: 'id',
    enableColumnFilter: false, // disable column filtering for this column
  },
  //...
]
//...
const table = useReactTable({
  columns,
  data,
  enableColumnFilters: false, // disable column filtering for all columns
})
```

#### Filtering Sub-Rows (Expanding)

There are a few additional table options to customize the behavior of column filtering when using features like expanding, grouping, and aggregation.

##### Filter From Leaf Rows

By default, filtering is done from parent rows down, so if a parent row is filtered out, all of its child sub-rows will be filtered out as well. Depending on your use-case, this may be the desired behavior if you only want the user to be searching through the top-level rows, and not the sub-rows. This is also the most performant option.

However, if you want to allow sub-rows to be filtered and searched through, regardless of whether the parent row is filtered out, you can set the `filterFromLeafRows` table option to `true`. Setting this option to `true` will cause filtering to be done from leaf rows up, which means parent rows will be included so long as one of their child or grand-child rows is also included.

```jsx
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  filterFromLeafRows: true, // filter and search through sub-rows
})
```

##### Max Leaf Row Filter Depth

By default, filtering is done for all rows in a tree, no matter if they are root level parent rows or the child leaf rows of a parent row. Setting the `maxLeafRowFilterDepth` table option to `0` will cause filtering to only be applied to the root level parent rows, with all sub-rows remaining unfiltered. Similarly, setting this option to `1` will cause filtering to only be applied to child leaf rows 1 level deep, and so on.

Use `maxLeafRowFilterDepth: 0` if you want to preserve a parent row's sub-rows from being filtered out while the parent row is passing the filter.

```jsx
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
  maxLeafRowFilterDepth: 0, // only filter root level parent rows out
})
```

### Column Filter APIs

There are a lot of Column and Table APIs that you can use to interact with the column filter state and hook up to your UI components. Here is a list of the available APIs and their most common use-cases:

- `table.setColumnFilters` - Overwrite the entire column filter state with a new state.
- `table.resetColumnFilters` - Useful for a "clear all/reset filters" button.

- **`column.getFilterValue`** - Useful for getting the default initial filter value for an input, or even directly providing the filter value to a filter input.
- **`column.setFilterValue`** - Useful for connecting filter inputs to their `onChange` or `onBlur` handlers.

- `column.getCanFilter` - Useful for disabling/enabling filter inputs.
- `column.getIsFiltered` - Useful for displaying a visual indicator that a column is currently being filtered.
- `column.getFilterIndex` - Useful for displaying in what order the current filter is being applied.

- `column.getAutoFilterFn` - Used internally to find the default filter function for a column if none is specified.
- `column.getFilterFn` - Useful for displaying which filter mode or function is currently being used.
