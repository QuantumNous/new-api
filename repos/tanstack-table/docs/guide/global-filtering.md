---
title: Global Filtering Guide
---

## Examples

Want to skip to the implementation? Check out these examples:

- [Global Filters](../framework/react/examples/filters-global)

## API

[Global Filtering API](../api/features/global-filtering)

## Global Filtering Guide

Filtering comes in 2 flavors: Column Filtering and Global Filtering.

This guide will focus on global filtering, which is a filter that is applied across all columns.

### Client-Side vs Server-Side Filtering

If you have a large dataset, you may not want to load all of that data into the client's browser in order to filter it. In this case, you will most likely want to implement server-side filtering, sorting, pagination, etc.

However, as also discussed in the [Pagination Guide](../guide/pagination#should-you-use-client-side-pagination), a lot of developers underestimate how many rows can be loaded client-side without a performance hit. The TanStack table examples are often tested to handle up to 100,000 rows or more with decent performance for client-side filtering, sorting, pagination, and grouping. This doesn't necessarily mean that your app will be able to handle that many rows, but if your table is only going to have a few thousand rows at most, you might be able to take advantage of the client-side filtering, sorting, pagination, and grouping that TanStack table provides.

> TanStack Table can handle thousands of client-side rows with good performance. Don't rule out client-side filtering, pagination, sorting, etc. without some thought first.

Every use-case is different and will depend on the complexity of the table, how many columns you have, how large every piece of data is, etc. The main bottlenecks to pay attention to are:

1. Can your server query all of the data in a reasonable amount of time (and cost)?
2. What is the total size of the fetch? (This might not scale as badly as you think if you don't have many columns.)
3. Is the client's browser using too much memory if all of the data is loaded at once?

If you're not sure, you can always start with client-side filtering and pagination and then switch to server-side strategies in the future as your data grows.

### Manual Server-Side Global Filtering

If you have decided that you need to implement server-side global filtering instead of using the built-in client-side global filtering, here's how you do that.

No `getFilteredRowModel` table option is needed for manual server-side global filtering. Instead, the `data` that you pass to the table should already be filtered. However, if you have passed a `getFilteredRowModel` table option, you can tell the table to skip it by setting the `manualFiltering` option to `true`.

```jsx
const table = useReactTable({
  data,
  columns,
  // getFilteredRowModel: getFilteredRowModel(), // not needed for manual server-side global filtering
  manualFiltering: true,
})
```

Note: When using manual global filtering, many of the options that are discussed in the rest of this guide will have no effect. When manualFiltering is set to true, the table instance will not apply any global filtering logic to the rows that are passed to it. Instead, it will assume that the rows are already filtered and will use the data that you pass to it as-is.

### Client-Side Global Filtering

If you are using the built-in client-side global filtering, first you need to pass in a getFilteredRowModel function to the table options.

```jsx
import { useReactTable, getFilteredRowModel } from '@tanstack/react-table'
//...
const table = useReactTable({
  // other options...
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(), // needed for client-side global filtering
})
```

### Global Filter Function

The globalFilterFn option allows you to specify the filter function that will be used for global filtering. The filter function can be a string that references a built-in filter function, a string that references a custom filter function provided via the tableOptions.filterFns option, or a custom filter function.

```jsx
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  globalFilterFn: 'text' // built-in filter function
})
```

By default there are 10 built-in filter functions to choose from:

- includesString - Case-insensitive string inclusion
- includesStringSensitive - Case-sensitive string inclusion
- equalsString - Case-insensitive string equality
- equalsStringSensitive - Case-sensitive string equality
- arrIncludes - Item inclusion within an array
- arrIncludesAll - All items included in an array
- arrIncludesSome - Some items included in an array
- equals - Object/referential equality Object.is/===
- weakEquals - Weak object/referential equality ==
- inNumberRange - Number range inclusion

You can also define your own custom filter functions either as the globalFilterFn table option.

### Global Filter State

The global filter state is stored in the table's internal state and can be accessed via the table.getState().globalFilter property. If you want to persist the global filter state outside of the table, you can use the onGlobalFilterChange option to provide a callback function that will be called whenever the global filter state changes.

```jsx
const [globalFilter, setGlobalFilter] = useState<any>([])

const table = useReactTable({
  // other options...
  state: {
    globalFilter,
  },
  onGlobalFilterChange: setGlobalFilter
})
```

The global filtering state is defined as an object with the following shape:

```jsx
interface GlobalFilter {
  globalFilter: any
}
```

### Adding global filter input to UI

TanStack table will not add a global filter input UI to your table. You should manually add it to your UI to allow users to filter the table. For example, you can add an input UI above the table to allow users to enter a search term.

```jsx
return (
  <div>
    <input
      value=""
      onChange={e => table.setGlobalFilter(String(e.target.value))}
      placeholder="Search..."
    />
  </div>
)
```

### Custom Global Filter Function

If you want to use a custom global filter function, you can define the function and pass it to the globalFilterFn option.

> **Note:** It is often a popular idea to use fuzzy filtering functions for global filtering. This is discussed in the [Fuzzy Filtering Guide](./fuzzy-filtering.md).

```jsx
const customFilterFn = (rows, columnId, filterValue) => {
  // custom filter logic
}

const table = useReactTable({
  // other options...
  globalFilterFn: customFilterFn
})
```

### Initial Global Filter State

If you want to set an initial global filter state when the table is initialized, you can pass the global filter state as part of the table initialState option.

However, you can also just specify the initial global filter state in the state.globalFilter option.

```jsx
const [globalFilter, setGlobalFilter] = useState("search term") //recommended to initialize globalFilter state here

const table = useReactTable({
  // other options...
  initialState: {
    globalFilter: 'search term', // if not managing globalFilter state, set initial state here
  }
  state: {
    globalFilter, // pass our managed globalFilter state to the table
  }
})
```

> NOTE: Do not use both initialState.globalFilter and state.globalFilter at the same time, as the initialized state in the state.globalFilter will override the initialState.globalFilter.

### Disable Global Filtering

By default, global filtering is enabled for all columns. You can disable the global filtering for all columns by using the enableGlobalFilter table option. You can also turn off both column and global filtering by setting the enableFilters table option to false.

Disabling global filtering will cause the column.getCanGlobalFilter API to return false for that column.

```jsx
const columns = [
  {
    header: () => 'Id',
    accessorKey: 'id',
    enableGlobalFilter: false, // disable global filtering for this column
  },
  //...
]
//...
const table = useReactTable({
  // other options...
  columns,
  enableGlobalFilter: false, // disable global filtering for all columns
})
```
