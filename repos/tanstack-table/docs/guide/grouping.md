---
title: Grouping Guide
---

## Examples

Want to skip to the implementation? Check out these examples:

- [grouping](../framework/react/examples/grouping)

## API

[Grouping API](../api/features/grouping)

## Grouping Guide

There are 3 table features that can reorder columns, which happen in the following order:

1. [Column Pinning](../guide/column-pinning) - If pinning, columns are split into left, center (unpinned), and right pinned columns.
2. Manual [Column Ordering](../guide/column-ordering) - A manually specified column order is applied.
3. **Grouping** - If grouping is enabled, a grouping state is active, and `tableOptions.groupedColumnMode` is set to `'reorder' | 'remove'`, then the grouped columns are reordered to the start of the column flow.

Grouping in TanStack table is a feature that applies to columns and allows you to categorize and organize the table rows based on specific columns. This can be useful in cases where you have a large amount of data and you want to group them together based on certain criteria.

To use the grouping feature, you will need to use the grouped row model. This model is responsible for grouping the rows based on the grouping state.

```tsx
import { getGroupedRowModel } from '@tanstack/react-table'

const table = useReactTable({
  // other options...
  getGroupedRowModel: getGroupedRowModel(),
})
```

When grouping state is active, the table will add matching rows as subRows to the grouped row. The grouped row will be added to the table rows at the same index as the first matching row. The matching rows will be removed from the table rows.
To allow the user to expand and collapse the grouped rows, you can use the expanding feature.

```tsx
import { getGroupedRowModel, getExpandedRowModel} from '@tanstack/react-table'

const table = useReactTable({
  // other options...
  getGroupedRowModel: getGroupedRowModel(),
  getExpandedRowModel: getExpandedRowModel(),
})
```

### Grouping state

The grouping state is an array of strings, where each string is the ID of a column to group by. The order of the strings in the array determines the order of the grouping. For example, if the grouping state is ['column1', 'column2'], then the table will first group by column1, and then within each group, it will group by column2. You can control the grouping state using the setGrouping function:

```tsx
table.setGrouping(['column1', 'column2']);
```

You can also reset the grouping state to its initial state using the resetGrouping function:

```tsx
table.resetGrouping();
```

By default, when a column is grouped, it is moved to the start of the table. You can control this behavior using the groupedColumnMode option. If you set it to 'reorder', then the grouped columns will be moved to the start of the table. If you set it to 'remove', then the grouped columns will be removed from the table. If you set it to false, then the grouped columns will not be moved or removed.

```tsx
const table = useReactTable({
  // other options...
  groupedColumnMode: 'reorder',
})
```

### Aggregations

When rows are grouped, you can aggregate the data in the grouped rows by columns using the aggregationFn option. This is a string that is the ID of the aggregation function. You can define the aggregation functions using the aggregationFns option.

```tsx
const column = columnHelper.accessor('key', {
  aggregationFn: 'sum',
})
```

In the above example, the sum aggregation function will be used to aggregate the data in the grouped rows.
By default, numeric columns will use the sum aggregation function, and non-numeric columns will use the count aggregation function. You can override this behavior by specifying the aggregationFn option in the column definition.

There are several built-in aggregation functions that you can use:

- sum - Sums the values in the grouped rows.
- count - Counts the number of rows in the grouped rows.
- min - Finds the minimum value in the grouped rows.
- max - Finds the maximum value in the grouped rows.
- extent - Finds the extent (min and max) of the values in the grouped rows.
- mean - Finds the mean of the values in the grouped rows.
- median - Finds the median of the values in the grouped rows.
- unique - Returns an array of unique values in the grouped rows.
- uniqueCount - Counts the number of unique values in the grouped rows.

#### Custom Aggregations

When rows are grouped, you can aggregate the data in the grouped rows using the aggregationFns option. This is a record where the keys are the IDs of the aggregation functions, and the values are the aggregation functions themselves. You can then reference these aggregation functions in a column's aggregationFn option.

```tsx
const table = useReactTable({
  // other options...
  aggregationFns: {
    myCustomAggregation: (columnId, leafRows, childRows) => {
      // return the aggregated value
    },
  },
})
```

In the above example, myCustomAggregation is a custom aggregation function that takes the column ID, the leaf rows, and the child rows, and returns the aggregated value. You can then use this aggregation function in a column's aggregationFn option:

```tsx
const column = columnHelper.accessor('key', {
  aggregationFn: 'myCustomAggregation',
})
```

### Manual Grouping

If you are doing server-side grouping and aggregation, you can enable manual grouping using the manualGrouping option. When this option is set to true, the table will not automatically group rows using getGroupedRowModel() and instead will expect you to manually group the rows before passing them to the table.

```tsx
const table = useReactTable({
  // other options...
  manualGrouping: true,
})
```

> **Note:** There are not currently many known easy ways to do server-side grouping with TanStack Table. You will need to do lots of custom cell rendering to make this work.

### Grouping Change Handler

If you want to manage the grouping state yourself, you can use the onGroupingChange option. This option is a function that is called when the grouping state changes. You can pass the managed state back to the table via the tableOptions.state.grouping option.

```tsx
const [grouping, setGrouping] = useState<string[]>([])

const table = useReactTable({
  // other options...
  state: {
    grouping: grouping,
  },
  onGroupingChange: setGrouping
})
```
