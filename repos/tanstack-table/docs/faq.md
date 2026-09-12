---
title: FAQ
---

## How do I stop infinite rendering loops?

If you are using React, there is a very common pitfall that can cause infinite rendering. If you fail to give your `columns`, `data`, or `state` a stable reference, React will enter an infinite loop of re-rendering upon any change to the table state.

Why does this happen? Is this a bug in TanStack Table? **No**, it is not. *This is fundamentally how React works*, and properly managing your columns, data, and state will prevent this from happening.

TanStack Table is designed to trigger a re-render whenever either the `data` or `columns` that are passed into the table change, or whenever any of the table's state changes.

> Failing to give `columns` or `data` stable references can cause an infinite loop of re-renders.

### Pitfall 1: Creating new columns or data on every render

```js
export default function MyComponent() {
  //😵 BAD: This will cause an infinite loop of re-renders because `columns` is redefined as a new array on every render!
  const columns = [
    // ...
  ];

  //😵 BAD: This will cause an infinite loop of re-renders because `data` is redefined as a new array on every render!
  const data = [
    // ...
  ];

  //❌ Columns and data are defined in the same scope as `useReactTable` without a stable reference, will cause infinite loop!
  const table = useReactTable({
    columns,
    data,
  });

  return <table>...</table>;
}
```

### Solution 1: Stable references with useMemo or useState

In React, you can give a "stable" reference to variables by defining them outside/above the component, or by using `useMemo` or `useState`, or by using a 3rd party state management library (like Redux or React Query 😉)

```js
//✅ OK: Define columns outside of the component
const columns = [
  // ...
];

//✅ OK: Define data outside of the component
const data = [
  // ...
];

// Usually it's more practical to define columns and data inside the component, so use `useMemo` or `useState` to give them stable references
export default function MyComponent() {
  //✅ GOOD: This will not cause an infinite loop of re-renders because `columns` is a stable reference
  const columns = useMemo(() => [
    // ...
  ], []);

  //✅ GOOD: This will not cause an infinite loop of re-renders because `data` is a stable reference
  const [data, setData] = useState(() => [
    // ...
  ]);

  // Columns and data are defined in a stable reference, will not cause infinite loop!
  const table = useReactTable({
    columns,
    data,
  });

  return <table>...</table>;
}
```

### Pitfall 2: Mutating columns or data in place

Even if you give your initial `columns` and `data` stable references, you can still run into infinite loops if you mutate them in place. This is a common pitfall that you may not notice that you are doing at first. Something as simple as an inline `data.filter()` can cause an infinite loop if you are not careful.

```js
export default function MyComponent() {
  //✅ GOOD
  const columns = useMemo(() => [
    // ...
  ], []);

  //✅ GOOD (React Query provides stable references to data automatically)
  const { data, isLoading } = useQuery({
    //...
  });

  const table = useReactTable({
    columns,
    //❌ BAD: This will cause an infinite loop of re-renders because `data` is mutated in place (destroys stable reference)
    data: data?.filter(d => d.isActive) ?? [],
  });

  return <table>...</table>;
}
```

### Solution 2: Memoize your data transformations

To prevent infinite loops, you should always memoize your data transformations. This can be done with `useMemo` or similar.

```js
export default function MyComponent() {
  //✅ GOOD
  const columns = useMemo(() => [
    // ...
  ], []);

  //✅ GOOD
  const { data, isLoading } = useQuery({
    //...
  });

  //✅ GOOD: This will not cause an infinite loop of re-renders because `filteredData` is memoized
  const filteredData = useMemo(() => data?.filter(d => d.isActive) ?? [], [data]);

  const table = useReactTable({
    columns,
    data: filteredData, // stable reference!
  });

  return <table>...</table>;
}
```

### React Forget

When React Forget is released, these problems might be a thing of the past. Or just use Solid.js... 🤓

## How do I stop my table state from automatically resetting when my data changes?

Most plugins use state that _should_ normally reset when the data sources changes, but sometimes you need to suppress that from happening if you are filtering your data externally, or immutably editing your data while looking at it, or simply doing anything external with your data that you don't want to trigger a piece of table state to reset automatically.

For those situations, each plugin provides a way to disable the state from automatically resetting internally when data or other dependencies for a piece of state change. By setting any of them to `false`, you can stop the automatic resets from being triggered.

Here is a React-based example of stopping basically every piece of state from changing as they normally do while we edit the `data` source for a table:

```js
const [data, setData] = React.useState([])
const skipPageResetRef = React.useRef()

const updateData = newData => {
  // When data gets updated with this function, set a flag
  // to disable all of the auto resetting
  skipPageResetRef.current = true

  setData(newData)
}

React.useEffect(() => {
  // After the table has updated, always remove the flag
  skipPageResetRef.current = false
})

useReactTable({
  ...
  autoResetPageIndex: !skipPageResetRef.current,
  autoResetExpanded: !skipPageResetRef.current,
})
```

Now, when we update our data, the above table states will not automatically reset!
