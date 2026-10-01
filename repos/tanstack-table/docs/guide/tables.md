---
title: Table Instance Guide
---

## API

[Table API](../api/core/table)

## Table Instance Guide

TanStack Table is a headless UI library. When we talk about the `table` or "table instance", we're not talking about a literal `<table>` element. Instead, we're referring to the core table object that contains the table state and APIs. The `table` instance is created by calling your adapter's `createTable` function (e.g. `useReactTable`, `useVueTable`, `createSolidTable`, `createSvelteTable`, `createAngularTable`, `useQwikTable`).

The `table` instance that is returned from the `createTable` function (from the framework adapter) is the main object that you will interact with to read and mutate the table state. It is the one place where everything happens in TanStack Table. When you get to the point where you are rendering your UI, you will use APIs from this `table` instance.

### Creating a Table Instance

To create a table instance, 3 `options` are required: `columns`, `data`, and a `getCoreRowModel` implementation. There are dozens of other table options to configure features and behavior, but these 3 are required.

#### Defining Data

Define your data as an array of objects with a stable reference. `data` can come from anywhere like an API response or defined statically in your code, but it must have a stable reference to prevent infinite re-renders. If using TypeScript, the type that you give your data will be used as a `TData` generic. See the [Data Guide](../guide/data) for more info.

#### Defining Columns

Column definitions are covered in detail in the previous section in the [Column Def Guide](../guide/column-defs). We'll note here, however, that when you define the type of your columns, you should use the same `TData` type that you used for your data.

```ts
const columns: ColumnDef<User>[] = [] //Pass User type as the generic TData type
//or
const columnHelper = createColumnHelper<User>() //Pass User type as the generic TData type
```

The column definitions are where we will tell TanStack Table how each column should access and/or transform row data with either an `accessorKey` or `accessorFn`. See the [Column Def Guide](../guide/column-defs#creating-accessor-columns) for more info.

#### Passing in Row Models

This is explained in much more detail in the [Row Models Guide](../guide/row-models), but for now, just import the `getCoreRowModel` function from TanStack Table and pass it in as a table option. Depending on the features you plan to use, you may need to pass in additional row models later.

```ts
import { getCoreRowModel } from '@tanstack/[framework]-table'

const table = createTable({ columns, data, getCoreRowModel: getCoreRowModel() })
```

#### Initializing the Table Instance

With our `columns`, `data`, and `getCoreRowModel` defined, we can now create our basic table instance, along side any other table options that we want to pass in.

```ts
//vanilla js
const table = createTable({ columns, data, getCoreRowModel: getCoreRowModel() })

//angular
this.table = createAngularTable({ columns: this.columns, data: this.data(), getCoreRowModel: getCoreRowModel() })

//lit
const table = this.tableController.table({ columns, data, getCoreRowModel: getCoreRowModel() })

//qwik
const table = useQwikTable({ columns, data, getCoreRowModel: getCoreRowModel() })

//react
const table = useReactTable({ columns, data, getCoreRowModel: getCoreRowModel() })

//solid
const table = createSolidTable({ columns, get data() { return data() }, getCoreRowModel: getCoreRowModel() })

//svelte
const table = createSvelteTable({ columns, data, getCoreRowModel: getCoreRowModel() })

//vue
const table = useVueTable({ columns, data, getCoreRowModel: getCoreRowModel() })
```

So what's in the `table` instance? Let's take a look at what interactions we can have with the table instance.

### Table State

The table instance contains all of the table state, which can be accessed via the `table.getState()` API. Each table feature registers various states in the table state. For example, the row selection feature registers `rowSelection` state, the pagination feature registers `pagination` state, etc.

Each feature will also have corresponding state setter APIs and state resetter APIs on the table instance. For example, the row selection feature will have a `setRowSelection` API and a `resetRowSelection`.

```ts
table.getState().rowSelection //read the row selection state
table.setRowSelection((old) => ({...old})) //set the row selection state
table.resetRowSelection() //reset the row selection state
```

This is covered in more detail in the [Table State Guides](../framework/react/guide/table-state)

### Table APIs

There are dozens of table APIs created by each feature to help you either read or mutate the table state in different ways.

API reference docs for the core table instance and all other feature APIs can be found throughout the API docs.

For example, you can find the core table instance API docs here: [Table API](../api/core/table#table-api)

### Table Row Models

There is a special set of table instance APIs for reading rows out of the table instance called row models. TanStack Table has advanced features where the rows that are generated may be very different than the array of `data` that you originally passed in. To learn more about the different row models that you can pass in as a table option, see the [Row Models Guide](../guide/row-models).
