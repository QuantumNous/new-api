---
title: Sorting Guide
---

## Examples

Want to skip to the implementation? Check out these examples:

- [sorting](../framework/react/examples/sorting)
- [filters](../framework/react/examples/filters)

## API

[Sorting API](../api/features/sorting)

## Sorting Guide

TanStack Table provides solutions for just about any sorting use-case you might have. This guide will walk you through the various options that you can use to customize the built-in client-side sorting functionality, as well as how to opt out of client-side sorting in favor of manual server-side sorting.

### Sorting State

The sorting state is defined as an array of objects with the following shape:

```tsx
type ColumnSort = {
  id: string
  desc: boolean
}
type SortingState = ColumnSort[]
```

Since the sorting state is an array, it is possible to sort by multiple columns at once. Read more about the multi-sorting customizations down [below](#multi-sorting).

#### Accessing Sorting State

You can access the sorting state directly from the table instance just like any other state using the `table.getState()` API.

```tsx
const table = useReactTable({
  columns,
  data,
  //...
})

console.log(table.getState().sorting) // access the sorting state from the table instance
```

However, if you need to access the sorting state before the table is initialized, you can "control" the sorting state like down below.

#### Controlled Sorting State

If you need easy access to the sorting state, you can control/manage the sorting state in your own state management with the `state.sorting` and `onSortingChange` table options.

```tsx
const [sorting, setSorting] = useState<SortingState>([]) // can set initial sorting state here
//...
// use sorting state to fetch data from your server or something...
//...
const table = useReactTable({
  columns,
  data,
  //...
  state: {
    sorting,
  },
  onSortingChange: setSorting,
})
```

#### Initial Sorting State

If you do not need to control the sorting state in your own state management or scope, but you still want to set an initial sorting state, you can use the `initialState` table option instead of `state`.

```jsx
const table = useReactTable({
  columns,
  data,
  //...
  initialState: {
    sorting: [
      {
        id: 'name',
        desc: true, // sort by name in descending order by default
      },
    ],
  },
})
```

> **NOTE**: Do not use both `initialState.sorting` and `state.sorting` at the same time, as the initialized state in the `state.sorting` will override the `initialState.sorting`.

### Client-Side vs Server-Side Sorting

Whether or not you should use client-side or server-side sorting depends entirely on whether you are also using client-side or server-side pagination or filtering. Be consistent, because using client-side sorting with server-side pagination or filtering will only sort the data that is currently loaded, and not the entire dataset.

### Manual Server-Side Sorting

If you plan to just use your own server-side sorting in your back-end logic, you do not need to provide a sorted row model. But if you have provided a sorting row model, but you want to disable it, you can use the `manualSorting` table option.

```jsx
const [sorting, setSorting] = useState<SortingState>([])
//...
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  //getSortedRowModel: getSortedRowModel(), //not needed for manual sorting
  manualSorting: true, //use pre-sorted row model instead of sorted row model
  state: {
    sorting,
  },
  onSortingChange: setSorting,
})
```

> **NOTE**: When `manualSorting` is set to `true`, the table will assume that the data that you provide is already sorted, and will not apply any sorting to it.

### Client-Side Sorting

To implement client-side sorting, first you have to provide a sorting row model to the table. You can import the `getSortedRowModel` function from TanStack Table, and it will be used to transform your rows into sorted rows.

```jsx
import { useReactTable } from '@tanstack/react-table'
//...
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(), //provide a sorting row model
})
```

### Sorting Fns

The default sorting function for all columns is inferred from the data type of the column. However, it can be useful to define the exact sorting function that you want to use for a specific column, especially if any of your data is nullable or not a standard data type.

You can determine a custom sorting function on a per-column basis using the `sortingFn` column option.

By default, there are 6 built-in sorting functions to choose from:

- `alphanumeric` - Sorts by mixed alphanumeric values without case-sensitivity. Slower, but more accurate if your strings contain numbers that need to be naturally sorted.
- `alphanumericCaseSensitive` - Sorts by mixed alphanumeric values with case-sensitivity. Slower, but more accurate if your strings contain numbers that need to be naturally sorted.
- `text` - Sorts by text/string values without case-sensitivity. Faster, but less accurate if your strings contain numbers that need to be naturally sorted.
- `textCaseSensitive` - Sorts by text/string values with case-sensitivity. Faster, but less accurate if your strings contain numbers that need to be naturally sorted.
- `datetime` - Sorts by time, use this if your values are `Date` objects.
- `basic` - Sorts using a basic/standard `a > b ? 1 : a < b ? -1 : 0` comparison. This is the fastest sorting function, but may not be the most accurate.

You can also define your own custom sorting functions either as the `sortingFn` column option, or as a global sorting function using the `sortingFns` table option.

#### Custom Sorting Functions

When defining a custom sorting function in either the `sortingFns` table option or as a `sortingFn` column option, it should have the following signature:

```tsx
//optionally use the SortingFn to infer the parameter types
const myCustomSortingFn: SortingFn<TData> = (rowA: Row<TData>, rowB: Row<TData>, columnId: string) => {
  return //-1, 0, or 1 - access any row data using rowA.original and rowB.original
}
```

> Note: The comparison function does not need to take whether or not the column is in descending or ascending order into account. The row models will take of that logic. `sortingFn` functions only need to provide a consistent comparison.

Every sorting function receives 2 rows and a column ID and are expected to compare the two rows using the column ID to return `-1`, `0`, or `1` in ascending order. Here's a cheat sheet:

| Return | Ascending Order |
| ------ | --------------- |
| `-1`   | `a < b`         |
| `0`    | `a === b`       |
| `1`    | `a > b`         |

```jsx
const columns = [
  {
    header: () => 'Name',
    accessorKey: 'name',
    sortingFn: 'alphanumeric', // use built-in sorting function by name
  },
  {
    header: () => 'Age',
    accessorKey: 'age',
    sortingFn: 'myCustomSortingFn', // use custom global sorting function
  },
  {
    header: () => 'Birthday',
    accessorKey: 'birthday',
    sortingFn: 'datetime', // recommended for date columns
  },
  {
    header: () => 'Profile',
    accessorKey: 'profile',
    // use custom sorting function directly
    sortingFn: (rowA, rowB, columnId) => {
      return rowA.original.someProperty - rowB.original.someProperty
    },
  }
]
//...
const table = useReactTable({
  columns,
  data,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  sortingFns: { //add a custom sorting function
    myCustomSortingFn: (rowA, rowB, columnId) => {
      return rowA.original[columnId] > rowB.original[columnId] ? 1 : rowA.original[columnId] < rowB.original[columnId] ? -1 : 0
    },
  },
})
```

### Customize Sorting

There are a lot of table and column options that you can use to further customize the sorting UX and behavior.

#### Disable Sorting

You can disable sorting for either a specific column or the entire table using the `enableSorting` column option or table option.

```jsx
const columns = [
  {
    header: () => 'ID',
    accessorKey: 'id',
    enableSorting: false, // disable sorting for this column
  },
  {
    header: () => 'Name',
    accessorKey: 'name',
  },
  //...
]
//...
const table = useReactTable({
  columns,
  data,
  enableSorting: false, // disable sorting for the entire table
})
```

#### Sorting Direction

By default, the first sorting direction when cycling through the sorting for a column using the `toggleSorting` APIs is ascending for string columns and descending for number columns. You can change this behavior with the `sortDescFirst` column option or table option.

```jsx
const columns = [
  {
    header: () => 'Name',
    accessorKey: 'name',
    sortDescFirst: true, //sort by name in descending order first (default is ascending for string columns)
  },
  {
    header: () => 'Age',
    accessorKey: 'age',
    sortDescFirst: false, //sort by age in ascending order first (default is descending for number columns)
  },
  //...
]
//...
const table = useReactTable({
  columns,
  data,
  sortDescFirst: true, //sort by all columns in descending order first (default is ascending for string columns and descending for number columns)
})
```

> **NOTE**: You may want to explicitly set the `sortDescFirst` column option on any columns that have nullable values. The table may not be able to properly determine if a column is a number or a string if it contains nullable values.

#### Invert Sorting

Inverting sorting is not the same as changing the default sorting direction. If `invertSorting` column option is `true` for a column, then the "desc/asc" sorting states will still cycle like normal, but the actual sorting of the rows will be inverted. This is useful for values that have an inverted best/worst scale where lower numbers are better, eg. a ranking (1st, 2nd, 3rd) or golf-like scoring.

```jsx
const columns = [
  {
    header: () => 'Rank',
    accessorKey: 'rank',
    invertSorting: true, // invert the sorting for this column. 1st -> 2nd -> 3rd -> ... even if "desc" sorting is applied
  },
  //...
]
```

#### Sort Undefined Values

Any undefined values will be sorted to the beginning or end of the list based on the `sortUndefined` column option or table option. You can customize this behavior for your specific use-case.

In not specified, the default value for `sortUndefined` is `1`, and undefined values will be sorted with lower priority (descending), if ascending, undefined will appear on the end of the list.

- `'first'` - Undefined values will be pushed to the beginning of the list
- `'last'` - Undefined values will be pushed to the end of the list
- `false` - Undefined values will be considered tied and need to be sorted by the next column filter or original index (whichever applies)
- `-1` - Undefined values will be sorted with higher priority (ascending) (if ascending, undefined will appear on the beginning of the list)
- `1` - Undefined values will be sorted with lower priority (descending) (if ascending, undefined will appear on the end of the list)

> NOTE: `'first'` and `'last'` options are new in v8.16.0

```jsx
const columns = [
  {
    header: () => 'Rank',
    accessorKey: 'rank',
    sortUndefined: -1, // 'first' | 'last' | 1 | -1 | false
  },
]
```

#### Sorting Removal

By default, the ability to remove sorting while cycling through the sorting states for a column is enabled. You can disable this behavior using the `enableSortingRemoval` table option. This behavior is useful if you want to ensure that at least one column is always sorted.

The default behavior when using either the `getToggleSortingHandler` or `toggleSorting` APIs is to cycle through the sorting states like this:

`'none' -> 'desc' -> 'asc' -> 'none' -> 'desc' -> 'asc' -> ...`

If you disable sorting removal, the behavior will be like this:

`'none' -> 'desc' -> 'asc' -> 'desc' -> 'asc' -> ...`

Once a column is sorted and `enableSortingRemoval` is `false`, toggling the sorting on that column will never remove the sorting. However, if the user sorts by another column and it is not a multi-sort event, then the sorting will be removed from the previous column and just applied to the new column.

> Set `enableSortingRemoval` to `false` if you want to ensure that at least one column is always sorted.

```jsx
const table = useReactTable({
  columns,
  data,
  enableSortingRemoval: false, // disable the ability to remove sorting on columns (always none -> asc -> desc -> asc)
})
```

#### Multi-Sorting

Sorting by multiple columns at once is enabled by default if using the `column.getToggleSortingHandler` API. If the user holds the `Shift` key while clicking on a column header, the table will sort by that column in addition to the columns that are already sorted. If you use the `column.toggleSorting` API, you have to manually pass in whether or not to use multi-sorting. (`column.toggleSorting(desc, multi)`).

##### Disable Multi-Sorting

You can disable multi-sorting for either a specific column or the entire table using the `enableMultiSort` column option or table option. Disabling multi-sorting for a specific column will replace all existing sorting with the new column's sorting.

```jsx
const columns = [
  {
    header: () => 'Created At',
    accessorKey: 'createdAt',
    enableMultiSort: false, // always sort by just this column if sorting by this column
  },
  //...
]
//...
const table = useReactTable({
  columns,
  data,
  enableMultiSort: false, // disable multi-sorting for the entire table
})
```

##### Customize Multi-Sorting Trigger

By default, the `Shift` key is used to trigger multi-sorting. You can change this behavior with the `isMultiSortEvent` table option. You can even specify that all sorting events should trigger multi-sorting by returning `true` from the custom function.

```jsx
const table = useReactTable({
  columns,
  data,
  isMultiSortEvent: (e) => true, // normal click triggers multi-sorting
  //or
  isMultiSortEvent: (e) => e.ctrlKey || e.shiftKey, // also use the `Ctrl` key to trigger multi-sorting
})
```

##### Multi-Sorting Limit

By default, there is no limit to the number of columns that can be sorted at once. You can set a limit using the `maxMultiSortColCount` table option.

```jsx
const table = useReactTable({
  columns,
  data,
  maxMultiSortColCount: 3, // only allow 3 columns to be sorted at once
})
```

##### Multi-Sorting Removal

By default, the ability to remove multi-sorts is enabled. You can disable this behavior using the `enableMultiRemove` table option.

```jsx
const table = useReactTable({
  columns,
  data,
  enableMultiRemove: false, // disable the ability to remove multi-sorts
})
```

### Sorting APIs

There are a lot of sorting related APIs that you can use to hook up to your UI or other logic. Here is a list of all of the sorting APIs and some of their use-cases.

- `table.setSorting` - Set the sorting state directly.
- `table.resetSorting` - Reset the sorting state to the initial state or clear it.

- `column.getCanSort` - Useful for enabling/disabling the sorting UI for a column.
- `column.getIsSorted` - Useful for showing a visual sorting indicator for a column.

- `column.getToggleSortingHandler` - Useful for hooking up the sorting UI for a column. Add to a sort arrow (icon button), menu item, or simply the entire column header cell. This handler will call `column.toggleSorting` with the correct parameters.
- `column.toggleSorting` - Useful for hooking up the sorting UI for a column. If using instead of `column.getToggleSortingHandler`, you have to manually pass in whether or not to use multi-sorting. (`column.toggleSorting(desc, multi)`)
- `column.clearSorting` - Useful for a "clear sorting" button or menu item for a specific column.

- `column.getNextSortingOrder` - Useful for showing which direction the column will sort by next. (asc/desc/clear in a tooltip/menu item/aria-label or something)
- `column.getFirstSortDir` - Useful for showing which direction the column will sort by first. (asc/desc in a tooltip/menu item/aria-label or something)
- `column.getAutoSortDir` - Determines whether the first sorting direction will be ascending or descending for a column.
- `column.getAutoSortingFn` - Used internally to find the default sorting function for a column if none is specified.
- `column.getSortingFn` - Returns the exact sorting function being used for a column.

- `column.getCanMultiSort` - Useful for enabling/disabling the multi-sorting UI for a column.
- `column.getSortIndex` - Useful for showing a badge or indicator of the column's sort order in a multi-sort scenario. i.e. whether or not it is the first, second, third, etc. column to be sorted.
