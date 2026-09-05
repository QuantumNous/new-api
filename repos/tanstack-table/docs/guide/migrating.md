---
title: Migrating to V8 Guide
---

## Migrating to V8

TanStack Table V8 was a major rewrite of React Table v7 from the ground up in TypeScript. The overall structure/organization of your markup and CSS will largely remain the same, but many of the APIs have been renamed or replaced.

### Notable Changes

- Full rewrite to TypeScript with types included in the base package
- Removal of plugin system to favor more inversion of control
- Vastly larger and improved API (and new features like pinning)
- Better controlled state management
- Better support for server-side operations
- Complete (but optional) data pipeline control
- Agnostic core with framework adapters for React, Solid, Svelte, Vue, and potentially more in the future
- New Dev Tools

### Install the new Version

The new version of TanStack Table is published under the `@tanstack` scope. Install the new package using your favorite package manager:

```bash
npm uninstall react-table @types/react-table
npm install @tanstack/react-table
```

```tsx
- import { useTable } from 'react-table' // [!code --]
+ import { useReactTable } from '@tanstack/react-table' // [!code ++]
```

Types are now included in the base package, so you can remove the `@types/react-table` package.

> If you want, you can keep the old `react-table` packages installed so that you can gradually migrate your code. You should be able to use both packages side-by-side for separate tables without any issues.

### Update Table Options

- Rename `useTable` to `useReactTable`
- The old hook and plugin systems have been removed, but they have replaced with tree-shakable row model imports for each feature.

```tsx
- import { useTable, usePagination, useSortBy } from 'react-table'; // [!code --]
+ import { // [!code ++]
+   useReactTable, // [!code ++]
+   getCoreRowModel, // [!code ++]
+   getPaginationRowModel, // [!code ++]
+   getSortedRowModel // [!code ++]
+ } from '@tanstack/react-table'; // [!code ++]

// ...

-   const tableInstance = useTable( // [!code --]
-     { columns,  data }, // [!code --]
-     useSortBy, // [!code --]
-     usePagination, //order of hooks used to matter // [!code --]
-     // etc. // [!code --]
-   ); // [!code --]
+   const tableInstance = useReactTable({ // [!code ++]
+     columns, // [!code ++]
+     data, // [!code ++]
+     getCoreRowModel: getCoreRowModel(), // [!code ++]
+     getPaginationRowModel: getPaginationRowModel(), // [!code ++]
+     getSortedRowModel: getSortedRowModel(), //order doesn't matter anymore! // [!code ++]
+     // etc. // [!code ++]
+   }); // [!code ++]
```

- All `disable*` table options were renamed to `enable*` table options. (e.g. `disableSortBy` is now `enableSorting`, `disableGroupBy` is now `enableGrouping`, etc.)
- ...

### Update column definitions

- accessor was renamed to either `accessorKey` or `accessorFn` (depending on whether you are using a string or function)
- width, minWidth, maxWidth were renamed to size, minSize, maxSize
- Optionally, you can use the new `createColumnHelper` function around each column definition for better TypeScript hints. (You can still just use an array of column definitions if you prefer.)
  - The first parameter is the accessor function or accessor string.
  - The second parameter is an object of column options.

```tsx
const columns = [
-  { // [!code --]
-    accessor: 'firstName', // [!code --]
-    Header: 'First Name', // [!code --]
-  }, // [!code --]
-  { // [!code --]
-    accessor: row => row.lastName, // [!code --]
-    Header: () => <span>Last Name</span>, // [!code --]
-  }, // [!code --]

// Best TypeScript experience, especially when using `cell.getValue()` later on
+  columnHelper.accessor('firstName', { //accessorKey // [!code ++]
+    header: 'First Name', // [!code ++]
+  }), // [!code ++]
+  columnHelper.accessor(row => row.lastName, { //accessorFn // [!code ++]
+    header: () => <span>Last Name</span>, // [!code ++]
+  }), // [!code ++]

// OR (if you prefer)
+ { // [!code ++]
+   accessorKey: 'firstName', // [!code ++]
+   header: 'First Name', // [!code ++]
+ }, // [!code ++]
+ { // [!code ++]
+   accessorFn: row => row.lastName, // [!code ++]
+   header: () => <span>Last Name</span>, // [!code ++]
+ }, // [!code ++]
]
```

> Note: If defining columns inside a component, you should still try to give the column definitions a stable identity. This will help with performance and prevent unnecessary re-renders. Store the column definitions in either a `useMemo` or `useState` hook.

- Column Option Name Changes

  - `Header` was renamed to `header`
  - `Cell` was renamed to `cell` (The cell render function has also changed. See below)
  - `Footer` was renamed to `footer`
  - All `disable*` column options were renamed to `enable*` column options. (e.g. `disableSortBy` is now `enableSorting`, `disableGroupBy` is now `enableGrouping`, etc.)
  - `sortType` `sortingFn`
  - ...

- Changes to custom cell renderers

  - `value` was renamed `getValue` (Throughout the upgrade, instead of providing the value directly, a function `getValue` is exposed for evaluating the value. This change aims to improve performance by evaluating the value only when `getValue()` is called and then caching it.)
  - `cell: { isGrouped, isPlaceholder, isAggregated }` is now `cell: { getIsGrouped, getIsPlaceholder, getIsAggregated }`
  - `column`: The base level props are now RT-specific. Values that you added to the object when defining it are now one level deeper in `columnDef`.
  - `table`: Props passed into the `useTable` hook now appear under `options`.

### Migrate Table Markup

- Use `flexRender()` instead of `cell.render('Cell')` or `column.render('Header')`, etc.
- `getHeaderProps`, `getFooterProps`, `getCellProps`, `getRowProps`, etc. have all been _deprecated_.
  - TanStack Table does not provide any default `style` or accessibility attributes like `role` anymore. These are still important for you to get right, but it had to be removed in order to support being framework-agnostic.
  - You will need to define `onClick` handlers manually, but there are new `get*Handler` helpers to keep this simple.
  - You will need to define the `key` props manually
  - You will need to define the `colSpan` prop manually if using features that require it (grouped headers, aggregation, etc.)

```tsx
- <th {...header.getHeaderProps()}>{cell.render('Header')}</th> // [!code --]
+ <th colSpan={header.colSpan} key={column.id}> // [!code ++]
+   {flexRender( // [!code ++]
+     header.column.columnDef.header, // [!code ++]
+     header.getContext() // [!code ++]
+   )} // [!code ++]
+ </th> // [!code ++]
```

```tsx
- <td {...cell.getCellProps()}>{cell.render('Cell')}</td> // [!code --]
+ <td key={cell.id}> // [!code ++]
+   {flexRender( // [!code ++]
+     cell.column.columnDef.cell, // [!code ++]
+     cell.getContext() // [!code ++]
+   )} // [!code ++]
+ </td> // [!code ++]
```

```tsx
// in column definitions in this case
- Header: ({ getToggleAllRowsSelectedProps }) => ( // [!code --]
-   <input type="checkbox" {...getToggleAllRowsSelectedProps()} /> // [!code --]
- ), // [!code --]
- Cell: ({ row }) => ( // [!code --]
-   <input type="checkbox" {...row.getToggleRowSelectedProps()} /> // [!code --]
- ), // [!code --]
+ header: ({ table }) => ( // [!code ++]
+   <Checkbox // [!code ++]
+     checked={table.getIsAllRowsSelected()} // [!code ++]
+     indeterminate={table.getIsSomeRowsSelected()} // [!code ++]
+     onChange={table.getToggleAllRowsSelectedHandler()} // [!code ++]
+   /> // [!code ++]
+ ), // [!code ++]
+ cell: ({ row }) => ( // [!code ++]
+   <Checkbox // [!code ++]
+     checked={row.getIsSelected()} // [!code ++]
+     disabled={!row.getCanSelect()} // [!code ++]
+     indeterminate={row.getIsSomeSelected()} // [!code ++]
+     onChange={row.getToggleSelectedHandler()} // [!code ++]
+   /> // [!code ++]
+ ), // [!code ++]
```

### Other Changes

- custom `filterTypes` (now called `filterFns`) have a new function signature as it only returns a boolean for whether the row should be included or not.

```tsx
- (rows: Row[], id: string, filterValue: any) => Row[] // [!code --]
+ (row: Row, id: string, filterValue: any) => boolean // [!code ++]
```

- ...

> This guide is a work in progress. Please consider contributing to it if you have time!
