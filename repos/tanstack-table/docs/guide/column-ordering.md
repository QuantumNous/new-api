---
title: Column Ordering Guide
---

## Examples

Want to skip to the implementation? Check out these examples:

- [column-ordering](../framework/react/examples/column-ordering)
- [column-dnd](../framework/react/examples/column-dnd)

## API

[Column Ordering API](../api/features/column-ordering)

## Column Ordering Guide

By default, columns are ordered in the order they are defined in the `columns` array. However, you can manually specify the column order using the `columnOrder` state. Other features like column pinning and grouping can also affect the column order.

### What Affects Column Order

There are 3 table features that can reorder columns, which happen in the following order:

1. [Column Pinning](../guide/column-pinning) - If pinning, columns are split into left, center (unpinned), and right pinned columns.
2. Manual **Column Ordering** - A manually specified column order is applied.
3. [Grouping](../guide/grouping) - If grouping is enabled, a grouping state is active, and `tableOptions.groupedColumnMode` is set to `'reorder' | 'remove'`, then the grouped columns are reordered to the start of the column flow.

> **Note:** `columnOrder` state will only affect unpinned columns if used in conjunction with column pinning.

### Column Order State

If you don't provide a `columnOrder` state, TanStack Table will just use the order of the columns in the `columns` array. However, you can provide an array of string column ids to the `columnOrder` state to specify the order of the columns.

#### Default Column Order

If all you need to do is specify the initial column order, you can just specify the `columnOrder` state in the `initialState` table option.

```jsx
const table = useReactTable({
  //...
  initialState: {
    columnOrder: ['columnId1', 'columnId2', 'columnId3'],
  }
  //...
});
```

> **Note:** If you are using the `state` table option to also specify the `columnOrder` state, the `initialState` will have no effect. Only specify particular states in either `initialState` or `state`, not both.

#### Managing Column Order State

If you need to dynamically change the column order, or set the column order after the table has been initialized, you can manage the `columnOrder` state just like any other table state.

```jsx
const [columnOrder, setColumnOrder] = useState<string[]>(['columnId1', 'columnId2', 'columnId3']); //optionally initialize the column order
//...
const table = useReactTable({
  //...
  state: {
    columnOrder,
    //...
  }
  onColumnOrderChange: setColumnOrder,
  //...
});
```

### Reordering Columns

If the table has UI that allows the user to reorder columns, you can set up the logic something like this:

```tsx
const [columnOrder, setColumnOrder] = useState<string[]>(columns.map(c => c.id));

//depending on your dnd solution of choice, you may or may not need state like this
const [movingColumnId, setMovingColumnId] = useState<string | null>(null);
const [targetColumnId, setTargetColumnId] = useState<string | null>(null);

//util function to splice and reorder the columnOrder array
const reorderColumn = <TData extends RowData>(
  movingColumnId: Column<TData>,
  targetColumnId: Column<TData>,
): string[] => {
  const newColumnOrder = [...columnOrder];
  newColumnOrder.splice(
    newColumnOrder.indexOf(targetColumnId),
    0,
    newColumnOrder.splice(newColumnOrder.indexOf(movingColumnId), 1)[0],
  );
  setColumnOrder(newColumnOrder);
};

const handleDragEnd = (e: DragEvent) => {
  if(!movingColumnId || !targetColumnId) return;
  setColumnOrder(reorderColumn(movingColumnId, targetColumnId));
};

//use your dnd solution of choice
```

#### Drag and Drop Column Reordering Suggestions (React)

There are undoubtedly many ways to implement drag and drop features along-side TanStack Table. Here are a few suggestions in order for you to not have a bad time:

1. Do NOT try to use [`"react-dnd"`](https://react-dnd.github.io/react-dnd/docs/overview) _if you are using React 18 or newer_. React DnD was an important library for its time, but it now does not get updated very often, and it has incompatibilities with React 18, especially in React Strict Mode. It is still possible to get it to work, but there are newer alternatives that have better compatibility and are more actively maintained. React DnD's Provider may also interfere and conflict with any other DnD solutions you may want to try in your app.

2. Use [`"@dnd-kit/core"`](https://dndkit.com/). DnD Kit is a modern, modular and lightweight drag and drop library that is highly compatible with the modern React ecosystem, and it works well with semantic `<table>` markup. Both of the official TanStack DnD examples, [Column DnD](../framework/react/examples/column-dnd) and [Row DnD](../framework/react/examples/row-dnd), now use DnD Kit.

3. Consider other DnD libraries like [`"react-beautiful-dnd"`](https://github.com/atlassian/react-beautiful-dnd), but be aware of their potentially large bundle sizes, maintenance status, and compatibility with `<table>` markup.

4. Consider using native browser events and state management to implement lightweight drag and drop features. However, be aware that this approach may not be best for mobile users if you do not go the extra mile to implement proper touch events. [Material React Table V2](https://www.material-react-table.com/docs/examples/column-ordering) is an example of a library that implements TanStack Table with only browser drag and drop events such as `onDragStart`, `onDragEnd`, `onDragEnter` and no other dependencies. Browse its source code to see how it is done.
