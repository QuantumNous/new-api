---
title: Custom Features Guide
---

## Examples

Want to skip to the implementation? Check out these examples:

- [custom-features](../framework/react/examples/custom-features)

## Custom Features Guide

In this guide, we'll cover how to extend TanStack Table with custom features, and along the way, we'll learn more about how the TanStack Table v8 codebase is structured and how it works.

### TanStack Table Strives to be Lean

TanStack Table has a core set of features that are built into the library such as sorting, filtering, pagination, etc. We've received a lot of requests and sometimes even some well thought out PRs to add even more features to the library. While we are always open to improving the library, we also want to make sure that TanStack Table remains a lean library that does not include too much bloat and code that is unlikely to be used in most use cases. Not every PR can, or should, be accepted into the core library, even if it does solve a real problem. This can be frustrating to developers where TanStack Table solves 90% of their use case, but they need a little bit more control. 

TanStack Table has always been built in a way that allows it to be highly extensible (at least since v7). The `table` instance that is returned from whichever framework adapter that you are using (`useReactTable`, `useVueTable`, etc) is a plain JavaScript object that can have extra properties or APIs added to it. It has always been possible to use composition to add custom logic, state, and APIs to the table instance. Libraries like [Material React Table](https://github.com/KevinVandy/material-react-table/blob/v2/packages/material-react-table/src/hooks/useMRT_TableInstance.ts) have simply created custom wrapper hooks around the `useReactTable` hook to extend the table instance with custom functionality.

However, starting in version 8.14.0, TanStack Table has exposed a new `_features` table option that allows you to more tightly and cleanly integrate custom code into the table instance in exactly the same way that the built-in table features are already integrated.

> TanStack Table v8.14.0 introduced a new `_features` option that allows you to add custom features to the table instance.

With this new tighter integration, you can easily add more complex custom features to your tables, and possibly even package them up and share them with the community. We'll see how this evolves over time. In a future v9 release, we may even lower the bundle size of TanStack Table by making all features opt-in, but that is still being explored.

### How TanStack Table Features Work

TanStack Table's source code is arguably somewhat simple (at least we think so). All code for each feature is split up into its own object/file with instantiation methods to create initial state, default table and column options, and API methods that can be added to the `table`, `header`, `column`, `row`, and `cell` instances.

All of the functionality of a feature object can be described with the `TableFeature` type that is exported from TanStack Table. This type is a TypeScript interface that describes the shape of a feature object needed to create a feature.

```ts
export interface TableFeature<TData extends RowData = any> {
  createCell?: (
    cell: Cell<TData, unknown>,
    column: Column<TData>,
    row: Row<TData>,
    table: Table<TData>
  ) => void
  createColumn?: (column: Column<TData, unknown>, table: Table<TData>) => void
  createHeader?: (header: Header<TData, unknown>, table: Table<TData>) => void
  createRow?: (row: Row<TData>, table: Table<TData>) => void
  createTable?: (table: Table<TData>) => void
  getDefaultColumnDef?: () => Partial<ColumnDef<TData, unknown>>
  getDefaultOptions?: (
    table: Table<TData>
  ) => Partial<TableOptionsResolved<TData>>
  getInitialState?: (initialState?: InitialTableState) => Partial<TableState>
}
```

This might be a bit confusing, so let's break down what each of these methods do:

#### Default Options and Initial State

<br />

##### getDefaultOptions

The `getDefaultOptions` method in a table feature is responsible for setting the default table options for that feature. For example, in the [Column Sizing](https://github.com/TanStack/table/blob/main/packages/table-core/src/features/ColumnSizing.ts) feature, the `getDefaultOptions` method sets the default `columnResizeMode` option with a default value of `"onEnd"`.

<br />

##### getDefaultColumnDef

The `getDefaultColumnDef` method in a table feature is responsible for setting the default column options for that feature. For example, in the [Sorting](https://github.com/TanStack/table/blob/main/packages/table-core/src/features/RowSorting.ts) feature, the `getDefaultColumnDef` method sets the default `sortUndefined` column option with a default value of `1`.

<br />

##### getInitialState

The `getInitialState` method in a table feature is responsible for setting the default state for that feature. For example, in the [Pagination](https://github.com/TanStack/table/blob/main/packages/table-core/src/features/RowPagination.ts) feature, the `getInitialState` method sets the default `pageSize` state with a value of `10` and the default `pageIndex` state with a value of `0`.

#### API Creators

<br />

##### createTable

The `createTable` method in a table feature is responsible for adding methods to the `table` instance. For example, in the [Row Selection](https://github.com/TanStack/table/blob/main/packages/table-core/src/features/RowSelection.ts) feature, the `createTable` method adds many table instance API methods such as `toggleAllRowsSelected`, `getIsAllRowsSelected`, `getIsSomeRowsSelected`, etc. So then, when you call `table.toggleAllRowsSelected()`, you are calling a method that was added to the table instance by the `RowSelection` feature.

<br />

##### createHeader

The `createHeader` method in a table feature is responsible for adding methods to the `header` instance. For example, in the [Column Sizing](https://github.com/TanStack/table/blob/main/packages/table-core/src/features/ColumnSizing.ts) feature, the `createHeader` method adds many header instance API methods such as `getStart`, and many others. So then, when you call `header.getStart()`, you are calling a method that was added to the header instance by the `ColumnSizing` feature.

<br />

##### createColumn

The `createColumn` method in a table feature is responsible for adding methods to the `column` instance. For example, in the [Sorting](https://github.com/TanStack/table/blob/main/packages/table-core/src/features/RowSorting.ts) feature, the `createColumn` method adds many column instance API methods such as `getNextSortingOrder`, `toggleSorting`, etc. So then, when you call `column.toggleSorting()`, you are calling a method that was added to the column instance by the `RowSorting` feature.

<br />

##### createRow

The `createRow` method in a table feature is responsible for adding methods to the `row` instance. For example, in the [Row Selection](https://github.com/TanStack/table/blob/main/packages/table-core/src/features/RowSelection.ts) feature, the `createRow` method adds many row instance API methods such as `toggleSelected`, `getIsSelected`, etc. So then, when you call `row.toggleSelected()`, you are calling a method that was added to the row instance by the `RowSelection` feature.

<br />

##### createCell

The `createCell` method in a table feature is responsible for adding methods to the `cell` instance. For example, in the [Column Grouping](https://github.com/TanStack/table/blob/main/packages/table-core/src/features/ColumnGrouping.ts) feature, the `createCell` method adds many cell instance API methods such as `getIsGrouped`, `getIsAggregated`, etc. So then, when you call `cell.getIsGrouped()`, you are calling a method that was added to the cell instance by the `ColumnGrouping` feature.

### Adding a Custom Feature

Let's walk through making a custom table feature for a hypothetical use case. Let's say we want to add a feature to the table instance that allows the user to change the "density" (padding of cells) of the table. 

Check out the full [custom-features](../framework/react/examples/custom-features) example to see the full implementation, but here's an in-depth look at the steps to create a custom feature.

#### Step 1: Set up TypeScript Types

Assuming you want the same full type-safety that the built-in features in TanStack Table have, let's set up all of the TypeScript types for our new feature. We'll create types for new table options, state, and table instance API methods.

These types are following the naming convention used internally within TanStack Table, but you can name them whatever you want. We are not adding these types to TanStack Table yet, but we'll do that in the next step.

```ts
// define types for our new feature's custom state
export type DensityState = 'sm' | 'md' | 'lg'
export interface DensityTableState {
  density: DensityState
}

// define types for our new feature's table options
export interface DensityOptions {
  enableDensity?: boolean
  onDensityChange?: OnChangeFn<DensityState>
}

// Define types for our new feature's table APIs
export interface DensityInstance {
  setDensity: (updater: Updater<DensityState>) => void
  toggleDensity: (value?: DensityState) => void
}
```

#### Step 2: Use Declaration Merging to Add New Types to TanStack Table

We can tell TypeScript to modify the exported types from TanStack Table to include our new feature's types. This is called "declaration merging" and it's a powerful feature of TypeScript. This way, we should not have to use any TypeScript hacks such as `as unknown as CustomTable` or `// @ts-ignore` in our new feature's code or in our application code.

```ts
// Use declaration merging to add our new feature APIs and state types to TanStack Table's existing types.
declare module '@tanstack/react-table' { // or whatever framework adapter you are using
  //merge our new feature's state with the existing table state
  interface TableState extends DensityTableState {}
  //merge our new feature's options with the existing table options
  interface TableOptionsResolved<TData extends RowData>
    extends DensityOptions {}
  //merge our new feature's instance APIs with the existing table instance APIs
  interface Table<TData extends RowData> extends DensityInstance {}
  // if you need to add cell instance APIs...
  // interface Cell<TData extends RowData, TValue> extends DensityCell
  // if you need to add row instance APIs...
  // interface Row<TData extends RowData> extends DensityRow
  // if you need to add column instance APIs...
  // interface Column<TData extends RowData, TValue> extends DensityColumn
  // if you need to add header instance APIs...
  // interface Header<TData extends RowData, TValue> extends DensityHeader

  // Note: declaration merging on `ColumnDef` is not possible because it is a complex type, not an interface.
  // But you can still use declaration merging on `ColumnDef.meta`
}
```

Once we do this correctly, we should have no TypeScript errors when we try to both create our new feature's code and use it in our application.

##### Caveats of Using Declaration Merging

One caveat of using declaration merging is that it will affect the TanStack Table types for every table across your codebase. This is not a problem if you plan on loading the same feature set for every table in your application, but it could be a problem if some of your tables load extra features and some do not. Alternatively, you can just make a bunch of custom types that extend off of the TanStack Table types with your new features added. This is what [Material React Table](https://github.com/KevinVandy/material-react-table/blob/v2/packages/material-react-table/src/types.ts) does in order to avoid affecting the types of vanilla TanStack Table tables, but it's a bit more tedious, and requires a lot of type casting at certain points.

#### Step 3: Create the Feature Object

With all of that TypeScript setup out of the way, we can now create the feature object for our new feature. This is where we define all of the methods that will be added to the table instance.

Use the `TableFeature` type to ensure that you are creating the feature object correctly. If the TypeScript types are set up correctly, you should have no TypeScript errors when you create the feature object with the new state, options, and instance APIs.

```ts
export const DensityFeature: TableFeature<any> = { //Use the TableFeature type!!
  // define the new feature's initial state
  getInitialState: (state): DensityTableState => {
    return {
      density: 'md',
      ...state,
    }
  },

  // define the new feature's default options
  getDefaultOptions: <TData extends RowData>(
    table: Table<TData>
  ): DensityOptions => {
    return {
      enableDensity: true,
      onDensityChange: makeStateUpdater('density', table),
    } as DensityOptions
  },
  // if you need to add a default column definition...
  // getDefaultColumnDef: <TData extends RowData>(): Partial<ColumnDef<TData>> => {
  //   return { meta: {} } //use meta instead of directly adding to the columnDef to avoid typescript stuff that's hard to workaround
  // },

  // define the new feature's table instance methods
  createTable: <TData extends RowData>(table: Table<TData>): void => {
    table.setDensity = updater => {
      const safeUpdater: Updater<DensityState> = old => {
        let newState = functionalUpdate(updater, old)
        return newState
      }
      return table.options.onDensityChange?.(safeUpdater)
    }
    table.toggleDensity = value => {
      table.setDensity(old => {
        if (value) return value
        return old === 'lg' ? 'md' : old === 'md' ? 'sm' : 'lg' //cycle through the 3 options
      })
    }
  },

  // if you need to add row instance APIs...
  // createRow: <TData extends RowData>(row, table): void => {},
  // if you need to add cell instance APIs...
  // createCell: <TData extends RowData>(cell, column, row, table): void => {},
  // if you need to add column instance APIs...
  // createColumn: <TData extends RowData>(column, table): void => {},
  // if you need to add header instance APIs...
  // createHeader: <TData extends RowData>(header, table): void => {},
}
```

#### Step 4: Add the Feature to the Table

Now that we have our feature object, we can add it to the table instance by passing it to the `_features` option when we create the table instance.

```ts
const table = useReactTable({
  _features: [DensityFeature], //pass the new feature to merge with all of the built-in features under the hood
  columns,
  data,
  //..
})
```

#### Step 5: Use the Feature in Your Application

Now that the feature is added to the table instance, you can use the new instance APIs options, and state in your application.

```tsx
const table = useReactTable({
  _features: [DensityFeature], //pass our custom feature to the table to be instantiated upon creation
  columns,
  data,
  //...
  state: {
    density, //passing the density state to the table, TS is still happy :)
  },
  onDensityChange: setDensity, //using the new onDensityChange option, TS is still happy :)
})
//...
const { density } = table.getState()
return(
  <td
    key={cell.id}
    style={{
      //using our new feature in the code
      padding:
        density === 'sm'
          ? '4px'
          : density === 'md'
            ? '8px'
            : '16px',
      transition: 'padding 0.2s',
    }}
  >
    {flexRender(
      cell.column.columnDef.cell,
      cell.getContext()
    )}
  </td>
)
```

#### Do We Have to Do It This Way?

This is just a new way to integrate custom code along-side the built-in features in TanStack Table. In our example up above, we could have just as easily stored the `density` state in a `React.useState`, defined our own `toggleDensity` handler wherever, and just used it in our code separately from the table instance. Building table features along-side TanStack Table instead of deeply integrating them into the table instance is still a perfectly valid way to build custom features. Depending on your use case, this may or may not be the cleanest way to extend TanStack Table with custom features.
