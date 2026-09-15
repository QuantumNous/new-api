---
title: Column Pinning Guide
---

## Examples

Want to skip to the implementation? Check out these examples:

- [column-pinning](../framework/react/examples/column-pinning)
- [sticky-column-pinning](../framework/react/examples/column-pinning-sticky)

 ### Other Examples
 
- [Svelte column-pinning](../framework/svelte/examples/column-pinning)
- [Vue column-pinning](../framework/vue/examples/column-pinning)

## API

[Column Pinning API](../api/features/column-pinning)

## Column Pinning Guide

TanStack Table offers state and APIs helpful for implementing column pinning features in your table UI. You can implement column pinning in multiple ways. You can either split pinned columns into their own separate tables, or you can keep all columns in the same table, but use the pinning state to order the columns correctly and use sticky CSS to pin the columns to the left or right.

### How Column Pinning Affects Column Order

There are 3 table features that can reorder columns, which happen in the following order:

1. **Column Pinning** - If pinning, columns are split into left, center (unpinned), and right pinned columns.
2. Manual [Column Ordering](../guide/column-ordering) - A manually specified column order is applied.
3. [Grouping](../guide/grouping) - If grouping is enabled, a grouping state is active, and `tableOptions.groupedColumnMode` is set to `'reorder' | 'remove'`, then the grouped columns are reordered to the start of the column flow.

The only way to change the order of the pinned columns is in the `columnPinning.left` and `columnPinning.right` state itself. `columnOrder` state will only affect the order of the unpinned ("center") columns.

### Column Pinning State

Managing the `columnPinning` state is optional, and usually not necessary unless you are adding persistent state features. TanStack Table will already keep track of the column pinning state for you. Manage the `columnPinning` state just like any other table state if you need to.

```jsx
const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
  left: [],
  right: [],
});
//...
const table = useReactTable({
  //...
  state: {
    columnPinning,
    //...
  }
  onColumnPinningChange: setColumnPinning,
  //...
});
```

### Pin Columns by Default

A very common use case is to pin some columns by default. You can do this by either initializing the `columnPinning` state with the pinned columnIds, or by using the `initialState` table option

```jsx
const table = useReactTable({
  //...
  initialState: {
    columnPinning: {
      left: ['expand-column'],
      right: ['actions-column'],
    },
    //...
  }
  //...
});
```

### Useful Column Pinning APIs

> Note: Some of these APIs are new in v8.12.0

There are a handful of useful Column API methods to help you implement column pinning features:

- [`column.getCanPin`](../api/features/column-pinning#getcanpin): Use to determine if a column can be pinned.
- [`column.pin`](../api/features/column-pinning#pin): Use to pin a column to the left or right. Or use to unpin a column.
- [`column.getIsPinned`](../api/features/column-pinning#getispinned): Use to determine where a column is pinned.
- [`column.getStart`](../api/features/column-pinning#getstart): Use to provide the correct `left` CSS value for a pinned column.
- [`column.getAfter`](../api/features/column-pinning#getafter): Use to provide the correct `right` CSS value for a pinned column.
- [`column.getIsLastColumn`](../api/features/column-pinning#getislastcolumn): Use to determine if a column is the last column in its pinned group. Useful for adding a box-shadow
- [`column.getIsFirstColumn`](../api/features/column-pinning#getisfirstcolumn): Use to determine if a column is the first column in its pinned group. Useful for adding a box-shadow

### Split Table Column Pinning

If you are just using sticky CSS to pin columns, you can for the most part, just render the table as you normally would with the `table.getHeaderGroups` and `row.getVisibleCells` methods.

However, if you are splitting up pinned columns into their own separate tables, you can make use of the `table.getLeftHeaderGroups`, `table.getCenterHeaderGroups`, `table.getRightHeaderGroups`, `row.getLeftVisibleCells`, `row.getCenterVisibleCells`, and `row.getRightVisibleCells` methods to only render the columns that are relevant to the current table.
